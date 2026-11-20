# 季律

美股指数季节性。用纽约收盘价，把标普 500、纳指 100、纳斯达克、道琼斯、罗素 2000 按月份、季度、星期和盘中小时拆开。

小时线大约只有近两年。历史分布不是交易信号。行情在打开页面时从 Yahoo Finance 现取，不需要数据库。

## Docker Compose

```bash
docker compose up -d --build
```

浏览器打开 `http://<服务器>:8098`。要换宿主机端口：

```bash
JILV_PORT=8090 docker compose up -d --build
```

更新代码后重新构建：`docker compose up -d --build`。停掉：`docker compose down`。

## 本地开发

```bash
npm install
npm run dev
```
