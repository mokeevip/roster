#!/bin/sh
set -eu

cd -- "$(dirname -- "$0")"

for command in node npm; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf '错误：未找到 %s，请先安装 Node.js 22 LTS（包含 npm）。\n' "$command" >&2
    exit 1
  fi
done

if [ ! -d node_modules ]; then
  printf '正在安装构建依赖……\n'
  npm ci
fi

printf '正在打包网页版和 Windows 桌面版……\n'
npm run pack:all

printf '\n打包完成：\n  %s\n  %s\n' \
  "$PWD/release/班级花名册-网页版.zip" \
  "$PWD/release/班级花名册.exe"
