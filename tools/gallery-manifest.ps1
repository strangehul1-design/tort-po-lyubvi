# Собирает assets/gallery.js по содержимому assets/photo.
#
# Зачем: браузеру нужно знать пропорции снимка ДО того, как он его
# скачает, иначе плитки галереи прыгают по мере загрузки. Поэтому
# реальные ширину и высоту читаем здесь, на машине, и вписываем
# в манифест, а разметка проставляет их в width/height у <img>.
#
# Запуск из корня проекта:
#   powershell -ExecutionPolicy Bypass -File tools/gallery-manifest.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root  = Split-Path -Parent $PSScriptRoot
$dir   = Join-Path $root 'assets\photo'
$out   = Join-Path $root 'assets\gallery.js'

if (-not (Test-Path $dir)) { throw "Нет папки $dir" }

$files = Get-ChildItem -Path $dir -File |
  Where-Object { $_.Extension -match '^\.(jpg|jpeg|png|webp)$' } |
  Sort-Object Name

$items = @()
foreach ($f in $files) {
  $w = 0; $h = 0
  try {
    $img = [System.Drawing.Image]::FromFile($f.FullName)
    $w = $img.Width; $h = $img.Height
    $img.Dispose()
  } catch {
    # WebP старый GDI+ не открывает — пропорции возьмёт CSS по умолчанию
    Write-Host ("  размеры не прочитались: " + $f.Name)
  }
  $items += "  { src: 'assets/photo/" + $f.Name + "', w: $w, h: $h },"
  Write-Host ("  " + $f.Name + "  " + $w + "x" + $h)
}

$body = @()
$body += '/* ═══════════════════════════════════════════'
$body += '   Список снимков для галереи. ФАЙЛ СОБИРАЕТСЯ АВТОМАТИЧЕСКИ —'
$body += '   правки руками затрёт следующий запуск.'
$body += '   Пересобрать:  powershell -ExecutionPolicy Bypass -File tools/gallery-manifest.ps1'
$body += '   ═══════════════════════════════════════════ */'
$body += 'window.GALLERY = ['
$body += $items
$body += '];'

[System.IO.File]::WriteAllLines($out, $body, (New-Object System.Text.UTF8Encoding $false))
Write-Host ''
Write-Host ("Готово: " + $items.Count + " снимков -> assets/gallery.js")
