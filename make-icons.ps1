Add-Type -AssemblyName System.Drawing
function Make($size, $path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#2b2623'))
  $f = New-Object System.Drawing.Font('Georgia', ($size * 0.42), [System.Drawing.FontStyle]::Italic, [System.Drawing.GraphicsUnit]::Pixel)
  $sf = New-Object System.Drawing.StringFormat; $sf.Alignment = 'Center'; $sf.LineAlignment = 'Center'
  $rect = New-Object System.Drawing.RectangleF 0, ($size * -0.04), $size, $size
  $g.DrawString('EI', $f, (New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#faf7f4'))), $rect, $sf)
  $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#d49c93')), ([Math]::Max(2, $size * 0.012))
  $g.DrawLine($pen, ($size * 0.3), ($size * 0.74), ($size * 0.7), ($size * 0.74))
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()
}
$d = Join-Path $PSScriptRoot 'icons'
Make 180 (Join-Path $d 'apple-touch-icon.png'); Make 192 (Join-Path $d 'icon-192.png'); Make 512 (Join-Path $d 'icon-512.png')
