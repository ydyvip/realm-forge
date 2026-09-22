#!/usr/bin/env python3
"""
万象工坊 · 构建脚本
把 src/ 下的 body.html + style.css + logic.js + ui.js + ui2.js + ui3.js + main.js
拼装成一个自包含的 realm-forge.html。

用法：
    python3 build.py
输出：
    ./realm-forge.html
"""
import os

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src') + os.sep
out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'realm-forge.html')

css = open(root + 'style.css', encoding='utf-8').read()
body = open(root + 'body.html', encoding='utf-8').read()
js = (
    open(root + 'logic.js', encoding='utf-8').read() + "\n"
    + open(root + 'ui.js', encoding='utf-8').read() + "\n"
    + open(root + 'ui2.js', encoding='utf-8').read() + "\n"
    + open(root + 'ui3.js', encoding='utf-8').read() + "\n"
    + open(root + 'main.js', encoding='utf-8').read()
)
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
print(f'已生成 {out_path}（{len(html)} 字节）')
