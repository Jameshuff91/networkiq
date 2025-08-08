#!/usr/bin/env python3
"""
Create simple NetworkIQ icon files
"""
from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size):
    # Create a new image with a purple background
    img = Image.new('RGB', (size, size), '#5E5ADB')
    draw = ImageDraw.Draw(img)
    
    # Draw a white circle
    margin = size // 8
    draw.ellipse([margin, margin, size - margin, size - margin], fill='white')
    
    # Draw the letter "N" in purple
    try:
        # Try to use a nice font, fallback to default if not available
        font_size = int(size * 0.5)
        font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', font_size)
    except:
        font = ImageFont.load_default()
    
    # Draw text
    text = "N"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    position = ((size - text_width) // 2, (size - text_height) // 2 - bbox[1])
    draw.text(position, text, fill='#5E5ADB', font=font)
    
    # Save the image
    filename = f'icon{size}.png'
    img.save(filename)
    print(f'Created {filename}')

# Create icons in different sizes
sizes = [16, 32, 48, 128]
for size in sizes:
    create_icon(size)

print('All icons created successfully!')