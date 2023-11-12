import cv2
import numpy as np
import sys

def extract_sprite(image_path, output_path):
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, threshed = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)

    contours, _ = cv2.findContours(threshed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        print("No contours found")
        sys.exit(1)

    cnt = max(contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(cnt)
    dst = img[y:y+h, x:x+w]

    # Convert to RGBA
    dst_rgba = cv2.cvtColor(dst, cv2.COLOR_BGR2BGRA)

    # Set near-white pixels to transparent
    white_threshold = 240  # Adjust as necessary
    mask = cv2.inRange(dst_rgba, np.array([white_threshold, white_threshold, white_threshold, 0]), np.array([255, 255, 255, 255]))
    dst_rgba[mask > 0] = (255, 255, 255, 0)

    cv2.imwrite(output_path, dst_rgba)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python extract_sprite.py <input_path> <output_path>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    extract_sprite(input_path, output_path)
