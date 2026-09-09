# Готовит фотографии сайта из папки assets/photo.
#
# Две папки — два назначения:
#   prices/   снимки тортов из прайса. N-й файл по порядку имени —
#             N-я позиция в таблице цен, поэтому имена нумерованные
#             (01.png, 02.png, ...). Порядок здесь смысловой, не
#             декоративный: перепутаете файлы — цена уедет к чужому торту.
#   gallery/  кадры со свадеб для галереи под отзывами.
#
# Что делает со всеми:
#   1. Разворачивает кадр по EXIF, если снимали боком.
#   2. Кладёт в web/ две облегчённые копии: -800 для страницы,
#      -1600 для просмотра во весь экран.
#   3. Пишет assets/gallery.js — window.PRICE_PHOTOS и window.GALLERY.
#
# Зачем две копии: карточка и плитка занимают 300-400 точек, и грузить
# туда исходник на несколько мегабайт — значит выложить посетителю
# с телефона десятки мегабайт. Браузер выберет размер по srcset сам.
#
# Зачем размеры в манифесте: браузер узнаёт пропорции до загрузки
# и резервирует место, поэтому картинки не прыгают.
#
# Оригиналы в репозиторий не идут — только копии из web.
#
# Запуск из корня проекта:
#   powershell -ExecutionPolicy Bypass -File tools/gallery-manifest.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$base = Join-Path $root 'assets\photo'
$web  = Join-Path $base 'web'
$out  = Join-Path $root 'assets\gallery.js'

if (-not (Test-Path $base)) { throw "Нет папки $base" }
if (-not (Test-Path $web)) { New-Item -ItemType Directory -Path $web | Out-Null }

# 82 — точка, где артефактов ещё не видно, а вес уже в разы меньше.
$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
        Where-Object { $_.MimeType -eq 'image/jpeg' }
$prm = New-Object System.Drawing.Imaging.EncoderParameters(1)
$prm.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality, [int64]82)

# Телефон пишет кадр как снят, а поворот кладёт в EXIF (тег 0x0112).
function Get-ExifRotation($img) {
    if ($img.PropertyIdList -notcontains 0x0112) { return $null }
    switch ($img.GetPropertyItem(0x0112).Value[0]) {
        3 { [System.Drawing.RotateFlipType]::Rotate180FlipNone }
        6 { [System.Drawing.RotateFlipType]::Rotate90FlipNone }
        8 { [System.Drawing.RotateFlipType]::Rotate270FlipNone }
        default { $null }
    }
}

function Save-Resized($img, $path, $maxSide, $quality = 82) {
    $pr = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $pr.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
        [System.Drawing.Imaging.Encoder]::Quality, [int64]$quality)
    $k = [Math]::Min(1.0, $maxSide / [Math]::Max($img.Width, $img.Height))  # мелкие не растягиваем
    $nw = [int][Math]::Round($img.Width * $k); $nh = [int][Math]::Round($img.Height * $k)
    $bmp = New-Object System.Drawing.Bitmap($nw, $nh)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode   = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode     = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode       = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.CompositingQuality  = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::White)   # прозрачность PNG в JPEG стала бы чёрной
    $g.DrawImage($img, 0, 0, $nw, $nh)
    $g.Dispose()
    $bmp.Save($path, $jpeg, $pr)
    $bmp.Dispose()
    return @($nw, $nh)
}

$script:totalIn = 0
$script:totalOut = 0

function Convert-Folder($dir, $prefix, $label, $quality = 82) {
    if (-not (Test-Path $dir)) { return @() }
    $files = Get-ChildItem -LiteralPath $dir -File |
             Where-Object { $_.Extension -match '^\.(jpg|jpeg|png|bmp)$' } |
             Sort-Object Name
    if ($files.Count -eq 0) { return @() }

    Write-Host ''
    Write-Host $label
    $lines = @()
    $n = 0
    foreach ($f in $files) {
        $n++
        $stem = '{0}{1:D2}' -f $prefix, $n
        $img = [System.Drawing.Image]::FromFile($f.FullName)
        try {
            $rot = Get-ExifRotation $img
            if ($rot) { $img.RotateFlip($rot) }
            $big   = Join-Path $web ($stem + '-1600.jpg')
            $small = Join-Path $web ($stem + '-800.jpg')
            $dim = Save-Resized $img $big 1600 $quality
            Save-Resized $img $small 800 $quality | Out-Null
        } finally { $img.Dispose() }

        $sizeOut = (Get-Item $big).Length + (Get-Item $small).Length
        $script:totalIn  += $f.Length
        $script:totalOut += $sizeOut

        $lines += "  { small: 'assets/photo/web/$stem-800.jpg', big: 'assets/photo/web/$stem-1600.jpg', w: $($dim[0]), h: $($dim[1]) },"
        Write-Host ("  {0,-16} -> {1}  {2}x{3}  {4:N0} КБ вместо {5:N0} КБ" -f `
            $f.Name, $stem, $dim[0], $dim[1], ($sizeOut/1KB), ($f.Length/1KB))
    }
    return $lines
}

Get-ChildItem -LiteralPath $web -File -Filter *.jpg -ErrorAction SilentlyContinue | Remove-Item -Force

$priceLines = @(Convert-Folder (Join-Path $base 'prices')  'p' 'Торты из прайса (порядок = номер позиции):')
$galLines   = @(Convert-Folder (Join-Path $base 'gallery') 'g' 'Кадры со свадеб для галереи:')
$revLines   = @(Convert-Folder (Join-Path $base 'reviews') 'r' 'Скриншоты отзывов:' 90)
$secLines   = @(Convert-Folder (Join-Path $base 'sections') 's' 'Фото разделов, по алфавиту имён:')
$wrkLines   = @(Convert-Folder (Join-Path $base 'works') 'w' 'Дополнительные работы:')

$body = @()
$body += '/* ═══════════════════════════════════════════'
$body += '   Фотографии сайта. ФАЙЛ СОБИРАЕТСЯ АВТОМАТИЧЕСКИ —'
$body += '   правки руками затрёт следующий запуск.'
$body += '   Пересобрать после добавления снимков в assets/photo:'
$body += '     powershell -ExecutionPolicy Bypass -File tools/gallery-manifest.ps1'
$body += '   ═══════════════════════════════════════════ */'
$body += ''
$body += '/* Торты из прайса. Порядок совпадает с порядком позиций'
$body += '   в assets/catalog.js: первый снимок — первая позиция. */'
$body += 'window.PRICE_PHOTOS = ['
$body += $priceLines
$body += '];'
$body += ''
$body += '/* Кадры со свадеб под отзывами. */'
$body += 'window.GALLERY = ['
$body += $galLines
$body += '];'
$body += ''
$body += '/* Скриншоты отзывов — порядок как в assets/photo/reviews. */'
$body += 'window.REVIEW_SHOTS = ['
$body += $revLines
$body += '];'
$body += ''
$body += '/* Фото разделов: s01 — годовщина, s02 — кондитер. */'
$body += 'window.SECTION_PHOTOS = ['
$body += $secLines
$body += '];'
$body += ''
$body += '/* Работы сверх прайса — идут в галерее следом за ним. */'
$body += 'window.WORK_PHOTOS = ['
$body += $wrkLines
$body += '];'

[System.IO.File]::WriteAllLines($out, $body, (New-Object System.Text.UTF8Encoding $false))

Write-Host ''
Write-Host ("Готово: {0} тортов, {1} со свадеб, {2} отзывов, {3} фото разделов." -f $priceLines.Count, $galLines.Count, $revLines.Count, $secLines.Count)
if ($script:totalIn -gt 0) {
    Write-Host ("Вес: {0:N1} МБ вместо {1:N1} МБ." -f ($script:totalOut/1MB), ($script:totalIn/1MB))
}
