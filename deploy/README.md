# ECS 部署说明（阿里云大陆区）

## 服务器要求

- Ubuntu 22.04 LTS，2 核 2G 起（建议加 2G swap）
- Node.js 20+（建议 nvm 安装后固定版本）
- Nginx、rsync、git

## 环境变量（/srv/ai-resume-assistant/.env，权限 600）

systemd 通过 `EnvironmentFile` 加载，文件格式为 `KEY=value`，含特殊字符用单引号包裹。

| 变量 | 说明 |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Supabase 项目 URL（公开） |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Supabase 公开 key（公开） |
| SUPABASE_SECRET_KEY | Supabase 服务端密钥（secret） |
| DEEPSEEK_API_KEY / DEEPSEEK_MODEL / DEEPSEEK_BASE_URL | DeepSeek 配置（secret） |
| DASHSCOPE_API_KEY / DASHSCOPE_MODEL / DASHSCOPE_BASE_URL | 阿里云百炼配置（secret） |
| WAFFO_MERCHANT_ID / WAFFO_STORE_ID / WAFFO_PRIVATE_KEY_BASE64 | Waffo Pancake（secret） |
| WAFFO_ENVIRONMENT | test 或 prod |
| WAFFO_SUPPORT_EMAIL | 客服邮箱 |
| BILLING_ENABLED | true/false |
| BILLING_CURRENCY | 如 USD |
| BILLING_PACKS | credits:price:productId, 逗号分隔 |
| ADMIN_CREDITS_TOKEN | 运营加点令牌（secret） |

## 初始化命令（root 执行一次）

```bash
# swap
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 用户与目录
useradd -m -s /bin/bash deploy
mkdir -p /srv/ai-resume-assistant/app
chown -R deploy:deploy /srv/ai-resume-assistant

# 放置 .env（deploy 用户可读）并保护
install -m 600 /dev/null /srv/ai-resume-assistant/.env
chown deploy:deploy /srv/ai-resume-assistant/.env

# systemd 服务
install -m 644 deploy/career-brief.service /etc/systemd/system/career-brief.service
systemctl daemon-reload
systemctl enable --now career-brief

# Nginx
install -m 644 deploy/nginx.conf /etc/nginx/sites-available/career-brief
ln -sf /etc/nginx/sites-available/career-brief /etc/nginx/sites-enabled/career-brief
nginx -t && systemctl reload nginx
```

## 部署（本地开发机执行）

```bash
DEPLOY_USER=deploy DEPLOY_HOST=<ECS公网IP> ./deploy/deploy.sh
```

备案通过并切换 DNS A 记录到 ECS 后，用 certbot 签发 HTTPS：

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d tianzhaoqun.top
```

## 回滚

把 `tianzhaoqun.top` 的 DNS A 记录改回 Netlify（75.2.60.5）即可，Netlify 部署保持不变。
