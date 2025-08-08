#!/usr/bin/env python3
"""
Create simple PNG icons without external dependencies
"""
import struct
import zlib

def create_png(size, filename):
    """Create a simple purple square PNG icon"""
    # Purple color RGB (94, 90, 219) = #5E5ADB
    purple = (94, 90, 219)
    
    # Create image data (RGBA)
    raw_data = b''
    for y in range(size):
        raw_data += b'\x00'  # Filter type: None
        for x in range(size):
            # Create a simple design: purple background with white center
            center = size // 2
            distance = ((x - center) ** 2 + (y - center) ** 2) ** 0.5
            
            if distance < size * 0.3:  # White circle in center
                raw_data += struct.pack('BBB', 255, 255, 255)  # White
            else:
                raw_data += struct.pack('BBB', *purple)  # Purple
            raw_data += b'\xff'  # Alpha: fully opaque
    
    # PNG file structure
    def png_chunk(chunk_type, data):
        chunk = struct.pack('>I', len(data)) + chunk_type + data
        crc = zlib.crc32(chunk_type + data)
        return chunk + struct.pack('>I', crc)
    
    # PNG signature
    png_data = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    png_data += png_chunk(b'IHDR', ihdr_data)
    
    # IDAT chunk (compressed image data)
    compressed = zlib.compress(raw_data)
    png_data += png_chunk(b'IDAT', compressed)
    
    # IEND chunk
    png_data += png_chunk(b'IEND', b'')
    
    # Write file
    with open(filename, 'wb') as f:
        f.write(png_data)
    
    print(f'Created {filename}')

# Create icons
for size in [16, 32, 48, 128]:
    create_png(size, f'icon{size}.png')

print('All icons created!')