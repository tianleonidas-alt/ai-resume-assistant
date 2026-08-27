#!/usr/bin/env bash
#
# Career Brief AI 求职助手 - ECS 部署脚本（在本地开发机执行）
#
# 前置：
#   1. 已在服务器安装 Node 20、Nginx、rsync，并配置好 systemd 服务 career-brief
#   2. 服务器已放置 /srv/ai-resume-assistant/.env（权限 600）
#   3. 本机可 SSH 到服务器（推荐密钥登录）
#
# 用法：./deploy/deploy.sh
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_HOST="${DEPLOY_HOST:-YOUR_ECS_PUBLIC_IP}"
REMOTE_BASE="/srv/ai-resume-assistant"
REMOTE_APP="${REMOTE_BASE}/app"

echo "==> 1/4 本地构建（standalone）"
ECS_STANDALONE=1 npm run build

echo "==> 2/4 上传 standalone 产物"
rsync -az --delete ".next/standalone/" "${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_APP}/"
rsync -az ".next/static/" "${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_APP}/.next/static/"
rsync -az "public/" "${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_APP}/public/"

echo "==> 3/4 重启服务"
ssh "${DEPLOY_USER}@${DEPLOY_HOST}" "sudo systemctl restart career-brief"

echo "==> 4/4 完成。验证：curl -s http://127.0.0.1:3000/api/billing/packs"
