# SketchToReal Design System

## Palette
- Background: `#000000` (pure black)
- Surface 1: `#0D0D0D`
- Surface 2: `#141414`
- Glass: `rgba(255,255,255,0.06)`
- Border: `rgba(255,255,255,0.1)`
- Electric Blue: `#00B4FF`
- Purple: `#8B5CF6`
- Gradient: `['#00B4FF', '#8B5CF6']` (blue → purple)
- Text Primary: `#FFFFFF`
- Text Secondary: `rgba(255,255,255,0.6)`
- Danger: `#FF4757`
- Success: `#2ED573`

## Typography
- Font: System default (SF Pro on iOS, Roboto on Android) — clean sans-serif
- Display: 36px bold
- Heading: 24px bold
- Subheading: 18px semibold
- Body: 15px regular
- Caption: 12px regular

## Effects
- Glassmorphism: background rgba(255,255,255,0.06), border rgba(255,255,255,0.12), blur
- Blue glow: shadow with electric blue at 40% opacity
- Spring animations via Reanimated 3
- Canvas: white brush on pure black, pressure-feel via velocity-based width

## Iconography
- phosphor-react-native, weight="duotone" for accents, weight="regular" for UI
