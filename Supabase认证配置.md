# Supabase 邮箱密码认证配置

代码已启用邮箱密码注册、登录和密码重置。当前产品允许用户注册后直接登录，不要求通过确认邮件激活账户；忘记密码时仍会发送密码重置链接。

## 1. Email Provider

在 **Authentication → Providers → Email**：

- 保持 Email Provider 开启。
- 关闭 **Confirm email**，让新用户注册后可立即登录。
- 将 **Minimum password length** 设置为 `8`。

## 2. URL Configuration

在 **Authentication → URL Configuration**：

- Site URL（本地开发）：`http://127.0.0.1:3000`
- Redirect URLs 增加：
  - `http://127.0.0.1:3000/auth/callback`

部署后，将上述地址替换或追加为正式域名，例如 `https://example.com/auth/callback`。

## 3. 密码重置邮件

保留 Supabase 默认 **Reset Password** 邮件模板即可。重置链接会回到网站的 `/auth/callback`，并跳转到重设密码页面。

新建项目若使用 Supabase 默认 SMTP，可能受到共享发送限额影响。正式环境建议配置自定义 SMTP。

## 4. 验收

1. 使用新邮箱和至少 8 位密码注册；注册后应直接处于登录状态。
2. 退出后用该邮箱和密码登录。
3. 点击“忘记密码”，重置邮件中的链接应进入重设密码页面。
