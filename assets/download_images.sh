#!/usr/bin/env bash
# Download teacher + book images from alzarifstore.net
set -u
cd "$(dirname "$0")"

TEACHER_DIR="./teachers"
BOOK_DIR="./books"
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

dl() {
  local url="$1"; local out="$2"
  if [[ -f "$out" ]]; then echo "skip (exists): $out"; return 0; fi
  curl -sS -L -A "$UA" --connect-timeout 20 --max-time 60 -o "$out" "$url" \
    && echo "ok:   $out" \
    || { echo "FAIL: $out <- $url"; rm -f "$out"; return 1; }
}

# ---------- Teachers (22) ----------
declare -A TEACHERS=(
  [2]="https://alzarifstores.com/Content/Teachers/Teacher_20251130141449.jpeg"
  [3]="https://alzarifstores.com/Content/Teachers/Teacher_20251130141832.jpeg"
  [4]="https://alzarifstores.com/Content/Teachers/Teacher_20251130141805.jpeg"
  [5]="https://alzarifstores.com/Content/Teachers/Teacher_20251130141724.jpeg"
  [6]="https://alzarifstores.com/Content/Teachers/Teacher_20251130141657.jpeg"
  [7]="https://alzarifstores.com/Content/Teachers/Teacher_20251130141618.jpeg"
  [8]="https://alzarifstores.com/Content/Teachers/Teacher_20251130141552.jpeg"
  [9]="https://alzarifstores.com/Content/Teachers/Teacher_20251130142000.jpeg"
  [10]="https://alzarifstores.com/Content/Teachers/Teacher_20251130141933.jpeg"
  [11]="https://alzarifstores.com/Content/Teachers/Teacher_20251130142032.jpeg"
  [12]="https://alzarifstores.com/Content/Teachers/Teacher_20251130142119.jpeg"
  [13]="https://alzarifstores.com/Content/Teachers/Teacher_20251031133043.jpeg"
  [14]="https://alzarifstores.com/Content/Teachers/Teacher_20251130142141.jpeg"
  [15]="https://alzarifstores.com/Content/Teachers/Teacher_20251130145403.jpeg"
  [16]="https://alzarifstores.com/Content/Teachers/Teacher_20251130170033.jpeg"
  [17]="https://alzarifstores.com/Content/Teachers/Teacher_20251130171509.jpeg"
  [18]="https://alzarifstores.com/Content/Teachers/Teacher_20251211192943.png"
  [19]="https://alzarifstores.com/Content/Teachers/Teacher_20251229165328.png"
  [20]="https://alzarifstores.com/Content/Teachers/Teacher_20260107225341.jpg"
  [21]="https://alzarifstores.com/Content/Teachers/Teacher_20260326165500.jpeg"
  [22]="https://alzarifstores.com/Content/Teachers/Teacher_20260329232545.png"
  [23]="https://alzarifstores.com/Content/Teachers/Teacher_20260329233002.png"
)

echo "=== Teachers (${#TEACHERS[@]}) ==="
for id in "${!TEACHERS[@]}"; do
  url="${TEACHERS[$id]}"
  ext="${url##*.}"
  dl "$url" "$TEACHER_DIR/teacher_${id}.${ext}"
done

# ---------- Books: unique covers ----------
# Map: book_id -> image URL (only books whose source gave a non-placeholder image)
declare -A BOOKS=(
  [331]="https://alzarifstores.com/Content/BooksImages/Book_Image_1_20260325174302.jpeg"
  [336]="https://alzarifstores.com/Content/BooksImages/Book_Image_1_20260403002450.jpg"
  [362]="https://alzarifstores.com/Content/BooksImages/Book_Image_1_20260330093222.jpeg"
  [364]="https://alzarifstores.com/Content/BooksImages/Book_Image_1_20260401183703.jpeg"
  [374]="https://alzarifstores.com/Content/BooksImages/Book_Image_1_20260331134611.jpeg"
  [375]="https://alzarifstores.com/Content/BooksImages/Book_Image_1_20260402161746.jpeg"
  [376]="https://alzarifstores.com/Content/BooksImages/Book_Image_1_20260402161902.jpeg"
  [377]="https://alzarifstores.com/Content/BooksImages/Book_Image_1_20260402172858.jpeg"
  [378]="https://alzarifstores.com/Content/BooksImages/Book_Image_1_20260404164533.jpeg"
  [379]="https://alzarifstores.com/Content/BooksImages/Book_Image_1_20260404225543.jpg"
  [380]="https://alzarifstores.com/Content/BooksImages/Book_Image_1_20260404225729.jpg"
  [381]="https://alzarifstores.com/Content/BooksImages/Book_Image_1_20260404225905.jpg"
)

echo ""
echo "=== Book covers (${#BOOKS[@]} unique) ==="
for id in "${!BOOKS[@]}"; do
  url="${BOOKS[$id]}"
  ext="${url##*.}"
  dl "$url" "$BOOK_DIR/book_${id}.${ext}"
done

# ---------- Placeholder ----------
echo ""
echo "=== Generic placeholder ==="
dl "https://alzarifstores.com/Content/cover.jpg" "$BOOK_DIR/_placeholder.jpg"

echo ""
echo "=== Done ==="
echo "Teachers: $(ls -1 $TEACHER_DIR 2>/dev/null | wc -l) files"
echo "Books:    $(ls -1 $BOOK_DIR 2>/dev/null | wc -l) files"
