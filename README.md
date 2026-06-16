# v2sub

在 Cloudflare Worker 上运行的订阅聚合器

## 部署步骤

1. Fork 存储库

2. 打开 wrangler.jsonc 并修改 kv_namespaces

```json
{
    "binding": "data",
    "id": "<这里填你的 KV Namespace ID>"
}
```

3. 创建 Worker, 并选择连接到存储库

4. 转到 Workers 和 Pages > 你的 Worker 名字 > 变量和机密, 添加如下变量 (类型选密钥)

> - jwt_secret: 用于加密 token 的密钥
> - password: 后台登录密码

## 功能支持

- 多机场订阅统一管理
- 一个订阅聚合所有节点
