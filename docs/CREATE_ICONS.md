# Quick Icon Creation Instructions

Since I can't create image files directly, here's how to quickly create placeholder icons:

## Option 1: Use an Online Tool (2 minutes)
1. Go to https://favicon.io/favicon-generator/
2. Type "NQ" or "N" as text
3. Choose a blue/professional color
4. Download the favicon package
5. Extract and rename files to:
   - favicon-16x16.png → icon16.png
   - favicon-32x32.png → icon32.png
   - android-chrome-192x192.png → icon128.png (resize to 128x128)
   - Copy icon32.png → icon48.png (Chrome will scale it)

## Option 2: Use ImageMagick (1 minute)
```bash
# Install ImageMagick if needed
brew install imagemagick

# Create simple colored square icons
cd extension/icons
convert -size 16x16 xc:'#0077B5' icon16.png
convert -size 32x32 xc:'#0077B5' icon32.png
convert -size 48x48 xc:'#0077B5' icon48.png
convert -size 128x128 xc:'#0077B5' icon128.png

# Or with text
convert -size 128x128 xc:'#0077B5' -fill white -gravity center -pointsize 72 -annotate +0+0 'N' icon128.png
convert -size 48x48 xc:'#0077B5' -fill white -gravity center -pointsize 28 -annotate +0+0 'N' icon48.png
convert -size 32x32 xc:'#0077B5' -fill white -gravity center -pointsize 18 -annotate +0+0 'N' icon32.png
convert -size 16x16 xc:'#0077B5' -fill white -gravity center -pointsize 10 -annotate +0+0 'N' icon16.png
```

## Option 3: Quick Python Script (30 seconds)
```python
from PIL import Image, ImageDraw, ImageFont

sizes = [16, 32, 48, 128]
color = (0, 119, 181)  # LinkedIn blue

for size in sizes:
    img = Image.new('RGB', (size, size), color)
    img.save(f'extension/icons/icon{size}.png')
```

Pick any option - the extension just needs these files to exist to load!