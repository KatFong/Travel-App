import express from 'express';
import { setupProxy } from './proxy';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 設置基本中間件
app.use(express.json());

// 設置 Proxy
setupProxy(app);

// 健康檢查端點
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 