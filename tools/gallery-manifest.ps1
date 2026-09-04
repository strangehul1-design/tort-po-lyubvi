# Готовит галерею из снимков, сложенных в assets/photo.
#
# Что делает:
#   1. Берёт все картинки из assets/photo (порядок — по имени файла).
#   2. Разворачивает кадр по EXIF, если телефон снимал боком.
#   3. Сохраняет две облегчённые копии в assets/photo/web:
#        -800.jpg   для плиток в сетке
#        -1600.jpg  для просмотра во весь экран
#   4. Пишет assets/gallery.js с именами и размерами.
#
# Зачем две копии: в сетке плитка занимает 300-400 точек, и грузить
# туда исходный снимок на несколько мегабайт — значит выложить
# посетителю с телефона десятки мегабайт трафика. Браузер сам выберет
# нужный размер по srcset, а полный кадр подтянет только при открытии.
#
# Зачем размеры в манифесте: браузер узнаёт пропорции до загрузки
# и резервирует место, поэтому плитки не прыгают.
#
# Оригиналы остаются лежать в assets/photo и в репозиторий не идут —
# на сайт выкладываются только облегчённые копии из web.
#
# Запуск из корня проекта:
#   powershell -ExecutionPolicy Bypass -File tools/gallery-manifest.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$src  = Join-Path $root 'assets\photo'
$web  = Join-Path $src  'web'
$out  = Join-Path $root 'assets\gallery.js'

if (-not (Test-Path $src)) { throw "Нет папки $src" }
if (-not (Test-Path $web)) { New-Item -ItemType Directory -Path $web | Out-Null }

# Кодировщик JPEG: 82 — та точка, где артефактов ещё не видно,
# а вес уже в разы меньше исходного.
$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
        Where-Object { $_.MimeType -eq 'image/jpeg' }
$prm = New-Object System.Drawing.Imaging.EncoderParameters(1)
$prm.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality, [int64]82)

# Телефон часто пишет кадр как снят, а поворот кладёт в EXIF (тег 0x0112).
# Без этого часть снимков легла бы на бок.
function Get-ExifRotation($img) {
    if ($img.PropertyIdList -notcontains 0x0112) { return $null }
    switch ($img.GetPropertyItem(0x0112).Value[0]) {
        3 { [System.Drawing.RotateFlipType]::Rotate180FlipNone }
        6 { [System.Drawing.RotateFlipType]::Rotate90FlipNone }
        8 { [System.Drawing.RotateFlipType]::Rotate270FlipNone }
        default { $null }
    }
}

function Save-Resized($img, $path, $maxSide) {
    $w = $img.Width; $h = $img.Height
    $k = [Math]::Min(1.0, $maxSide / [Math]::Max($w, $h))   # не растягиваем мелкие
    $nw = [int][Math]::Round($w * $k); $nh = [int][Math]::Round($h * $k)
    $bmp = New-Object System.Drawing.Bitmap($nw, $nh)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode  = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode    = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    # белая подложка: у PNG бывает прозрачность, в JPEG она стала бы чёрной
    $g.Clear([System.Drawing.Color]::White)
    $g.DrawImage($img, 0, 0, $nw, $nh)
    $g.Dispose()
    $bmp.Save($path, $jpeg, $prm)
    $bmp.Dispose()
    return @($nw, $nh)
}

$files = Get-ChildItem -Path $src -File |
         Where-Object { $_.Extension -match '^\.(jpg|jpeg|png|bmp)$' } |
         Sort-Object Name

if ($files.Count -eq 0) { Write-Host 'В assets/photo нет снимков — галерея покажет заглушки.' }

Get-ChildItem -Path $web -File -Filter *.jpg -ErrorAction SilentlyContinue | Remove-Item -Force

$items = @()
$n = 0
$totalIn = 0; $totalOut = 0
foreach ($f in $files) {
    $n++
    $stem = 'w{0:D2}' -f $n
    $img = [System.Drawing.Image]::FromFile($f.FullName)
    try {
        $rot = Get-ExifRotation $img
        if ($rot) { $img.RotateFlip($rot) }

        $big   = Join-Path $web ($stem + '-1600.jpg')
        $small = Join-Path $web ($stem + '-800.jpg')
        $dim = Save-Resized $img $big 1600
        Save-Resized $img $small 800 | Out-Null
    } finally {
        $img.Dispose()
    }

    $sizeIn  = $f.Length
    $sizeOut = (Get-Item $big).Length + (Get-Item $small).Length
    $totalIn += $sizeIn; $totalOut += $sizeOut

    $items += "  { small: 'assets/photo/web/$stem-800.jpg', big: 'assets/photo/web/$stem-1600.jpg', w: $($dim[0]), h: $($dim[1]) },"
    Write-Host ("  {0,-16} -> {1}  {2}x{3}  {4:N0} КБ вместо {5:N0} КБ" -f `
        $f.Name, $stem, $dim[0], $dim[1], ($sizeOut/1KB), ($sizeIn/1KB))
}

$body = @()
$body += '/* ═══════════════════════════════════════════'
$body += '   Список снимков галереи. ФАЙЛ СОБИРАЕТСЯ АВТОМАТИЧЕСКИ —'
$body += '   правки руками затрёт следующий запуск.'
$body += '   Пересобрать после добавления фото в assets/photo:'
$body += '     powershell -ExecutionPolicy Bypass -File tools/gallery-manifest.ps1'
$body += '   ═══════════════════════════════════════════ */'
$body += 'window.GALLERY = ['
$body += $items
$body += '];'

[System.IO.File]::WriteAllLines($out, $body, (New-Object System.Text.UTF8Encoding $false))

Write-Host ''
if ($files.Count -gt 0) {
    Write-Host ("Готово: {0} снимков. Вес галереи {1:N1} МБ вместо {2:N1} МБ." -f `
        $files.Count, ($totalOut/1MB), ($totalIn/1MB))
} else {
    Write-Host 'Готово: снимков нет.'
}
