#!/usr/bin/env python3
import json
import sys

from PIL import Image, ImageOps


TARGET_SIZE = (512, 512)


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: normalize_texture.py <input> <output>", file=sys.stderr)
        return 2

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    try:
        with Image.open(input_path) as image:
            image = ImageOps.exif_transpose(image)
            image = image.convert("RGBA")
            image = ImageOps.fit(image, TARGET_SIZE, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
            image.save(output_path, format="PNG", optimize=True)
    except Exception as error:
        print(f"Could not normalize texture: {error}", file=sys.stderr)
        return 1

    print(json.dumps({"width": TARGET_SIZE[0], "height": TARGET_SIZE[1]}), file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
