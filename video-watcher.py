#!/usr/bin/env python3
"""
video-watcher.py
Polls /reel/pending every 10s.
For each pending job, writes the prompt + image URLs to a file,
then signals the main agent process to generate video.
This is the bridge between the app server and the agent's video_generate tool.
"""
import json, time, subprocess, os, sys, tempfile, pathlib

API = "http://localhost:4200/api"
QUEUE_FILE = "/tmp/reel-video-queue.json"
DONE_FILE = "/tmp/reel-video-done.json"

def get_pending():
    r = subprocess.run(["curl", "-s", f"{API}/reel/pending"], capture_output=True, text=True)
    try:
        return json.loads(r.stdout).get("jobs", [])
    except:
        return []

def patch_job(job_id, video_url):
    payload = json.dumps({"videoUrl": video_url, "videoType": "ai", "addMusic": True})
    r = subprocess.run([
        "curl", "-s", "-X", "PATCH",
        f"{API}/reel/{job_id}/complete",
        "-H", "Content-Type: application/json",
        "-d", payload
    ], capture_output=True, text=True)
    print(f"[watcher] PATCH {job_id}: {r.stdout[:100]}")

def upload_video(path):
    r = subprocess.run(["upload", path], capture_output=True, text=True)
    url = r.stdout.strip()
    if url.startswith("http"):
        return url
    return None

processed = set()

print("[watcher] Started. Polling /reel/pending every 10s...")

while True:
    jobs = get_pending()
    for job in jobs:
        jid = job.get("id")
        if not jid or jid in processed:
            continue
        
        prompt = job.get("cinematicPrompt") or f"Cinematic video: {job.get('albumName', 'Reel')}"
        print(f"[watcher] New job {jid}: {prompt[:80]}...")
        
        # Write to queue file for agent to pick up
        queue = []
        if os.path.exists(QUEUE_FILE):
            try:
                queue = json.loads(open(QUEUE_FILE).read())
            except:
                queue = []
        
        # Check if already in queue
        if any(q.get("id") == jid for q in queue):
            continue
            
        queue.append({
            "id": jid,
            "prompt": prompt,
            "imageUrls": json.loads(job.get("imageUrls", "[]")) if isinstance(job.get("imageUrls"), str) else job.get("imageUrls", []),
            "albumName": job.get("albumName", "Reel"),
            "ts": time.time()
        })
        open(QUEUE_FILE, "w").write(json.dumps(queue, indent=2))
        print(f"[watcher] Queued job {jid} for agent video generation")
        processed.add(jid)
    
    # Check done file — agent writes completed video paths here
    if os.path.exists(DONE_FILE):
        try:
            done = json.loads(open(DONE_FILE).read())
            remaining = []
            for item in done:
                jid = item.get("id")
                path = item.get("videoPath")
                if jid and path and os.path.exists(path):
                    url = upload_video(path)
                    if url:
                        patch_job(jid, url)
                        print(f"[watcher] Completed job {jid} -> {url[:60]}")
                    else:
                        remaining.append(item)
                else:
                    remaining.append(item)
            open(DONE_FILE, "w").write(json.dumps(remaining, indent=2))
        except Exception as e:
            print(f"[watcher] done file error: {e}")
    
    time.sleep(10)
