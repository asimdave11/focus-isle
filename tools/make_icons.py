"""Generate pixel-art PNG app icons (stdlib only). Run: python3 tools/make_icons.py"""
import struct, zlib, os

OAK = [
    '................', '.....gggggg.....', '...ggGGGGGGgg...', '..gGGGlGGGGGGg..',
    '.gGGlllGGGGGGGg.', '.gGGGlGGGGGlGGg.', '.gGGGGGGGGllGGg.', '.gGGGGGGGGGGGGg.',
    '..gGGGGGlGGGGg..', '...ggGGGGGGgg...', '.....ggbbgg.....', '.......bb.......',
    '.......bb.......', '......bbbb......', '.....bB..Bb.....', '................',
]
PAL = {'g': (45, 106, 79), 'G': (64, 145, 108), 'l': (116, 198, 157), 'b': (127, 85, 57), 'B': (94, 59, 34)}
BG, WATER, SAND, GRASS, DIRT = (21, 26, 45), (47, 111, 174), (233, 216, 166), (106, 176, 76), (138, 90, 59)

def grid():
    N = 32
    px = [[WATER] * N for _ in range(N)]
    for y in range(N):
        for x in range(N):
            d = ((x - 15.5) / 13) ** 2 + ((y - 19) / 9) ** 2
            if d < 1.0: px[y][x] = SAND
            if d < 0.78: px[y][x] = GRASS
            if 0.78 <= d < 1.0 and y > 19: px[y][x] = DIRT
    for r, row in enumerate(OAK):
        for c, ch in enumerate(row):
            if ch != '.': px[r + 6][c + 8] = PAL[ch]
    return px

def png(path, size):
    g = grid(); s = size / 32
    raw = b''.join(b'\x00' + b''.join(bytes(g[int(y / s)][int(x / s)]) for x in range(size)) for y in range(size))
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(data)

out = os.path.join(os.path.dirname(__file__), '..', 'icons')
for n in (180, 192, 512): png(os.path.join(out, f'icon-{n}.png'), n)
print('ok')
