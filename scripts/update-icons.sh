#!/bin/bash
set -e

# Complete Icon Update Script
# Updates both Liquid Glass icon bundle AND all platform fallback icons from exports

cd "$(dirname "$0")/.."

EXPORTS_DIR="tauri/assets/voicebox_exports"
ICON_BUNDLE="tauri/assets/voicebox.icon"
ASSETS_DIR="$ICON_BUNDLE/Assets"
ICONS_DIR="tauri/src-tauri/icons"
SOURCE_ICON="$EXPORTS_DIR/voicebox-iOS-Default-1024x1024@1x.png"

echo "🎨 Updating all Voicebox icons from exports..."
echo ""

# Check if source exists
if [ ! -f "$SOURCE_ICON" ]; then
  echo "Error: Source icon not found at $SOURCE_ICON"
  exit 1
fi

# ============================================
# PART 1: Update voicebox.icon Bundle
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Part 1: Updating Liquid Glass Icon Bundle"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

mkdir -p "$ASSETS_DIR"

echo "Copying appearance variants..."
cp "$EXPORTS_DIR/voicebox-iOS-Default-1024x1024@1x.png" "$ASSETS_DIR/Voicebox.png"
echo "  ✓ Default"

[ -f "$EXPORTS_DIR/voicebox-iOS-Dark-1024x1024@1x.png" ] && {
  cp "$EXPORTS_DIR/voicebox-iOS-Dark-1024x1024@1x.png" "$ASSETS_DIR/Voicebox-Dark.png"
  echo "  ✓ Dark"
}

[ -f "$EXPORTS_DIR/voicebox-iOS-ClearLight-1024x1024@1x.png" ] && {
  cp "$EXPORTS_DIR/voicebox-iOS-ClearLight-1024x1024@1x.png" "$ASSETS_DIR/Voicebox-ClearLight.png"
  echo "  ✓ Clear Light"
}

[ -f "$EXPORTS_DIR/voicebox-iOS-ClearDark-1024x1024@1x.png" ] && {
  cp "$EXPORTS_DIR/voicebox-iOS-ClearDark-1024x1024@1x.png" "$ASSETS_DIR/Voicebox-ClearDark.png"
  echo "  ✓ Clear Dark"
}

[ -f "$EXPORTS_DIR/voicebox-iOS-TintedLight-1024x1024@1x.png" ] && {
  cp "$EXPORTS_DIR/voicebox-iOS-TintedLight-1024x1024@1x.png" "$ASSETS_DIR/Voicebox-TintedLight.png"
  echo "  ✓ Tinted Light"
}

[ -f "$EXPORTS_DIR/voicebox-iOS-TintedDark-1024x1024@1x.png" ] && {
  cp "$EXPORTS_DIR/voicebox-iOS-TintedDark-1024x1024@1x.png" "$ASSETS_DIR/Voicebox-TintedDark.png"
  echo "  ✓ Tinted Dark"
}

echo ""
echo "Updating icon.json..."

cat > "$ICON_BUNDLE/icon.json" << 'EOF'
{
  "fill" : "automatic",
  "groups" : [
    {
      "layers" : [
        {
          "blend-mode" : "normal",
          "glass" : true,
          "image-name" : "Voicebox.png",
          "name" : "Voicebox",
          "position" : {
            "scale" : 0.37,
            "translation-in-points" : [
              -0.12338405356129378,
              297.27705195772353
            ]
          }
        }
      ],
      "shadow" : {
        "kind" : "neutral",
        "opacity" : 0.5
      },
      "translucency" : {
        "enabled" : true,
        "value" : 0.5
      }
    }
  ],
  "appearances" : [
    {
      "appearance" : "light",
      "groups" : [
        {
          "layers" : [
            {
              "blend-mode" : "normal",
              "glass" : true,
              "image-name" : "Voicebox.png",
              "name" : "Voicebox"
            }
          ]
        }
      ]
    },
    {
      "appearance" : "dark",
      "groups" : [
        {
          "layers" : [
            {
              "blend-mode" : "normal",
              "glass" : true,
              "image-name" : "Voicebox-Dark.png",
              "name" : "Voicebox Dark"
            }
          ]
        }
      ]
    },
    {
      "appearance" : "light",
      "contrast" : "clear",
      "groups" : [
        {
          "layers" : [
            {
              "blend-mode" : "normal",
              "glass" : true,
              "image-name" : "Voicebox-ClearLight.png",
              "name" : "Voicebox Clear Light"
            }
          ]
        }
      ]
    },
    {
      "appearance" : "dark",
      "contrast" : "clear",
      "groups" : [
        {
          "layers" : [
            {
              "blend-mode" : "normal",
              "glass" : true,
              "image-name" : "Voicebox-ClearDark.png",
              "name" : "Voicebox Clear Dark"
            }
          ]
        }
      ]
    },
    {
      "appearance" : "light",
      "contrast" : "tinted",
      "groups" : [
        {
          "layers" : [
            {
              "blend-mode" : "normal",
              "glass" : true,
              "image-name" : "Voicebox-TintedLight.png",
              "name" : "Voicebox Tinted Light"
            }
          ]
        }
      ]
    },
    {
      "appearance" : "dark",
      "contrast" : "tinted",
      "groups" : [
        {
          "layers" : [
            {
              "blend-mode" : "normal",
              "glass" : true,
              "image-name" : "Voicebox-TintedDark.png",
              "name" : "Voicebox Tinted Dark"
            }
          ]
        }
      ]
    }
  ],
  "supported-platforms" : {
    "circles" : [
      "watchOS"
    ],
    "squares" : "shared"
  }
}
EOF

echo "  ✓ icon.json updated"
echo ""

# ============================================
# PART 2: Generate Platform Fallback Icons
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🖼️  Part 2: Generating Platform Fallback Icons"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

mkdir -p "$ICONS_DIR"

# macOS & Desktop Icons
echo "Generating macOS/Desktop icons..."
sips -s format png -z 32 32 "$SOURCE_ICON" --out "$ICONS_DIR/32x32.png" 2>/dev/null
sips -s format png -z 64 64 "$SOURCE_ICON" --out "$ICONS_DIR/64x64.png" 2>/dev/null
sips -s format png -z 128 128 "$SOURCE_ICON" --out "$ICONS_DIR/128x128.png" 2>/dev/null
sips -s format png -z 256 256 "$SOURCE_ICON" --out "$ICONS_DIR/128x128@2x.png" 2>/dev/null
sips -s format png -z 512 512 "$SOURCE_ICON" --out "$ICONS_DIR/icon.png" 2>/dev/null

# Generate ICNS
echo "Generating icon.icns..."
mkdir -p /tmp/voicebox-iconset.iconset
sips -s format png -z 16 16 "$SOURCE_ICON" --out /tmp/voicebox-iconset.iconset/icon_16x16.png 2>/dev/null
sips -s format png -z 32 32 "$SOURCE_ICON" --out /tmp/voicebox-iconset.iconset/icon_16x16@2x.png 2>/dev/null
sips -s format png -z 32 32 "$SOURCE_ICON" --out /tmp/voicebox-iconset.iconset/icon_32x32.png 2>/dev/null
sips -s format png -z 64 64 "$SOURCE_ICON" --out /tmp/voicebox-iconset.iconset/icon_32x32@2x.png 2>/dev/null
sips -s format png -z 128 128 "$SOURCE_ICON" --out /tmp/voicebox-iconset.iconset/icon_128x128.png 2>/dev/null
sips -s format png -z 256 256 "$SOURCE_ICON" --out /tmp/voicebox-iconset.iconset/icon_128x128@2x.png 2>/dev/null
sips -s format png -z 256 256 "$SOURCE_ICON" --out /tmp/voicebox-iconset.iconset/icon_256x256.png 2>/dev/null
sips -s format png -z 512 512 "$SOURCE_ICON" --out /tmp/voicebox-iconset.iconset/icon_256x256@2x.png 2>/dev/null
sips -s format png -z 512 512 "$SOURCE_ICON" --out /tmp/voicebox-iconset.iconset/icon_512x512.png 2>/dev/null
sips -s format png -z 1024 1024 "$SOURCE_ICON" --out /tmp/voicebox-iconset.iconset/icon_512x512@2x.png 2>/dev/null
iconutil -c icns /tmp/voicebox-iconset.iconset -o "$ICONS_DIR/icon.icns"
rm -rf /tmp/voicebox-iconset.iconset

# Windows Square Logos
echo "Generating Windows icons..."
for size in 30 44 71 89 107 142 150 284 310; do
  sips -s format png -z $size $size "$SOURCE_ICON" --out "$ICONS_DIR/Square${size}x${size}Logo.png" 2>/dev/null
done
sips -s format png -z 50 50 "$SOURCE_ICON" --out "$ICONS_DIR/StoreLogo.png" 2>/dev/null

# iOS Icons
echo "Generating iOS icons..."
mkdir -p "$ICONS_DIR/ios"

declare -A ios_sizes=(
  ["AppIcon-20x20@1x.png"]="20"
  ["AppIcon-20x20@2x.png"]="40"
  ["AppIcon-20x20@2x-1.png"]="40"
  ["AppIcon-20x20@3x.png"]="60"
  ["AppIcon-29x29@1x.png"]="29"
  ["AppIcon-29x29@2x.png"]="58"
  ["AppIcon-29x29@2x-1.png"]="58"
  ["AppIcon-29x29@3x.png"]="87"
  ["AppIcon-40x40@1x.png"]="40"
  ["AppIcon-40x40@2x.png"]="80"
  ["AppIcon-40x40@2x-1.png"]="80"
  ["AppIcon-40x40@3x.png"]="120"
  ["AppIcon-60x60@2x.png"]="120"
  ["AppIcon-60x60@3x.png"]="180"
  ["AppIcon-76x76@1x.png"]="76"
  ["AppIcon-76x76@2x.png"]="152"
  ["AppIcon-83.5x83.5@2x.png"]="167"
  ["AppIcon-512@2x.png"]="1024"
)

for filename in "${!ios_sizes[@]}"; do
  size="${ios_sizes[$filename]}"
  sips -s format png -z $size $size "$SOURCE_ICON" --out "$ICONS_DIR/ios/$filename" 2>/dev/null
done

# Android Icons
echo "Generating Android icons..."
mkdir -p "$ICONS_DIR/android/mipmap-mdpi"
mkdir -p "$ICONS_DIR/android/mipmap-hdpi"
mkdir -p "$ICONS_DIR/android/mipmap-xhdpi"
mkdir -p "$ICONS_DIR/android/mipmap-xxhdpi"
mkdir -p "$ICONS_DIR/android/mipmap-xxxhdpi"

sips -s format png -z 48 48 "$SOURCE_ICON" --out "$ICONS_DIR/android/mipmap-mdpi/ic_launcher.png" 2>/dev/null
sips -s format png -z 48 48 "$SOURCE_ICON" --out "$ICONS_DIR/android/mipmap-mdpi/ic_launcher_round.png" 2>/dev/null
sips -s format png -z 48 48 "$SOURCE_ICON" --out "$ICONS_DIR/android/mipmap-mdpi/ic_launcher_foreground.png" 2>/dev/null

sips -s format png -z 72 72 "$SOURCE_ICON" --out "$ICONS_DIR/android/mipmap-hdpi/ic_launcher.png" 2>/dev/null
sips -s format png -z 72 72 "$SOURCE_ICON" --out "$ICONS_DIR/android/mipmap-hdpi/ic_launcher_round.png" 2>/dev/null
sips -s format png -z 72 72 "$SOURCE_ICON" --out "$ICONS_DIR/android/mipmap-hdpi/ic_launcher_foreground.png" 2>/dev/null

sips -s format png -z 96 96 "$SOURCE_ICON" --out "$ICONS_DIR/android/mipmap-xhdpi/ic_launcher.png" 2>/dev/null
sips -s format png -z 96 96 "$SOURCE_ICON" --out "$ICONS_DIR/android/mipmap-xhdpi/ic_launcher_round.png" 2>/dev/null
sips -s format png -z 96 96 "$SOURCE_ICON" --out "$ICONS_DIR/android/mipmap-xhdpi/ic_launcher_foreground.png" 2>/dev/null

sips -s format png -z 144 144 "$SOURCE_ICON" --out "$ICONS_DIR/android/mipmap-xxhdpi/ic_launcher.png" 2>/dev/null
sips -s format png -z 144 144 "$SOURCE_ICON" --out "$ICONS_DIR/android/mipmap-xxhdpi/ic_launcher_round.png" 2>/dev/null
sips -s format png -z 144 144 "$SOURCE_ICON" --out "$ICONS_DIR/android/mipmap-xxhdpi/ic_launcher_foreground.png" 2>/dev/null

sips -s format png -z 192 192 "$SOURCE_ICON" --out "$ICONS_DIR/android/mipmap-xxxhdpi/ic_launcher.png" 2>/dev/null
sips -s format png -z 192 192 "$SOURCE_ICON" --out "$ICONS_DIR/android/mipmap-xxxhdpi/ic_launcher_round.png" 2>/dev/null
sips -s format png -z 192 192 "$SOURCE_ICON" --out "$ICONS_DIR/android/mipmap-xxxhdpi/ic_launcher_foreground.png" 2>/dev/null

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All icons updated successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Updated:"
echo "  ✓ Liquid Glass icon bundle with all appearance variants"
echo "  ✓ macOS/Desktop fallback icons"
echo "  ✓ Windows Square logos"
echo "  ✓ iOS AppIcons (18 sizes)"
echo "  ✓ Android mipmap icons (5 densities)"
echo ""
echo "Next: Rebuild the app with 'cd tauri && bun run tauri build'"
