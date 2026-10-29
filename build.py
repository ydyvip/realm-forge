#!/usr/bin/env python3
"""
万象工坊 / Realm Forge · 构建脚本 / build script
把 src/ 下的 body.html + style.css + logic.js + i18n_strings.js + ui.js
+ ui2.js + ui3.js + main.js 拼装成一个自包含的 realm-forge.html。

Assembles src/body.html + style.css + logic.js + i18n_strings.js + ui.js
+ ui2.js + ui3.js + main.js into one self-contained realm-forge.html.

用法 / usage:
    python3 build.py               # 普通构建 / plain build
    python3 build.py --obfuscate   # 混淆 JS 后构建 / obfuscated build (requires Node.js + npx)
输出 / output:
    ./realm-forge.html
"""
import argparse
import os
import shutil
import subprocess
import tempfile

OBFUSCATOR_VERSION = '5.9.0'

parser = argparse.ArgumentParser(description='Build realm-forge.html from src/.')
parser.add_argument('--obfuscate', action='store_true', help='obfuscate the generated JavaScript bundle with javascript-obfuscator')
args = parser.parse_args()

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src') + os.sep
out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'realm-forge.html')

css = open(root + 'style.css', encoding='utf-8').read()
body = open(root + 'body.html', encoding='utf-8').read()
js = (
    open(root + 'logic.js', encoding='utf-8').read() + "\n"
    + open(root + 'i18n_strings.js', encoding='utf-8').read() + "\n"
    + open(root + 'ui.js', encoding='utf-8').read() + "\n"
    + open(root + 'ui2.js', encoding='utf-8').read() + "\n"
    + open(root + 'ui3.js', encoding='utf-8').read() + "\n"
    + open(root + 'main.js', encoding='utf-8').read()
)


def obfuscate_js(source: str) -> str:
    """Run javascript-obfuscator over the concatenated bundle.

    Obfuscation is deterrence, not security: anyone with the file can still run
    and reverse-engineer it. Keep the plain build for local development.
    """
    npx = shutil.which('npx')
    if not npx:
        raise SystemExit('--obfuscate requires Node.js/npx; install Node.js or run the plain build.')
    with tempfile.TemporaryDirectory(prefix='realm-forge-obf-') as tmp:
        src = os.path.join(tmp, 'app.js')
        dst = os.path.join(tmp, 'app.obf.js')
        with open(src, 'w', encoding='utf-8') as f:
            f.write(source)
        cmd = [
            npx, '--yes', f'javascript-obfuscator@{OBFUSCATOR_VERSION}', src, '--output', dst,
            '--compact', 'true',
            '--string-array', 'true',
            '--string-array-encoding', 'base64',
            '--string-array-threshold', '0.75',
            '--string-array-rotate', 'true',
            '--string-array-shuffle', 'true',
            '--split-strings', 'true',
            '--split-strings-chunk-length', '8',
            '--identifier-names-generator', 'hexadecimal',
            '--rename-globals', 'true',
            '--self-defending', 'false',
            '--control-flow-flattening', 'false',
            '--dead-code-injection', 'false',
            '--simplify', 'true',
            '--target', 'browser',
            '--seed', 'realm-forge',
        ]
        subprocess.run(cmd, check=True)
        with open(dst, encoding='utf-8') as f:
            return f.read()


if args.obfuscate:
    js = obfuscate_js(js)
assert '</script' not in js

html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>万象工坊 · 沙盒世界与角色系统</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@700&display=swap" rel="stylesheet">
<style>
{css}
</style>
</head>
<body>
{body}
<script>
{js}
</script>
</body>
</html>
'''

with open(out_path, 'w', encoding='utf-8') as f:
    f.write(html)
print(f'已生成 / wrote {out_path} ({len(html)} bytes{ ", obfuscated" if args.obfuscate else "" })')
