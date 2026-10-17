import 'dotenv/config';
import { createApp } from './app.mjs';
const port = Number(process.env.API_PORT || 8000);
createApp().listen(port, '127.0.0.1', () => console.log(`BlendLab API: http://127.0.0.1:${port}`));
