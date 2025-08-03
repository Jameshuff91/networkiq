#!/usr/bin/env python3
"""
Quick script to create placeholder icons for the Chrome extension
Requires: pip install pillow
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Create icons directory if it doesn't exist
os.makedirs('extension/icons', exist_ok=True)

# LinkedIn blue color
LINKEDIN_BLUE = (0, 119, 181)
WHITE = (255, 255, 255)

# Icon sizes required by Chrome
sizes = [16, 32, 48, 128]

for size in sizes:
    # Create new image with LinkedIn blue background
    img = Image.new('RGB', (size, size), LINKEDIN_BLUE)
    draw = ImageDraw.Draw(img)
    
    # Add "N" text in white (for NetworkIQ)
    # Try to use a font, fall back to default if not available
    try:
        # Adjust font size based on icon size
        font_size = int(size * 0.6)
        # Try to use a system font
        from PIL import ImageFont
        try:
            # macOS font paths
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        except:
            try:
                # Linux font paths
                font = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", font_size)
            except:
                # Use default font
                font = ImageFont.load_default()
    except:
        font = ImageFont.load_default()
    
    # Draw text centered
    text = "N"
    # Get text size
    if hasattr(draw, 'textbbox'):
        # Newer Pillow versions
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
    else:
        # Older Pillow versions
        text_width, text_height = draw.textsize(text, font=font)
    
    position = ((size - text_width) // 2, (size - text_height) // 2)
    draw.text(position, text, fill=WHITE, font=font)
    
    # Save the icon
    filename = f'extension/icons/icon{size}.png'
    img.save(filename)
    print(f"Created {filename}")

print("\n✅ All icons created successfully!")
print("You can now load the extension in Chrome:")
print("1. Open chrome://extensions/")
print("2. Enable Developer mode")
print("3. Click 'Load unpacked'")
print("4. Select the 'extension' folder")