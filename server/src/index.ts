import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {dashboardRouter} from './routes/dashboard.js';
import {restockRouter} from './routes/restock.js';
import {authRouter} from './routes/auth.js';
import {requireShopifyAuth} from './middleware/shopify-auth.js';
import {syncRouter} from './routes/sync.js';
const app=express();app.use(cors({origin:true,credentials:false}));app.use(express.json());app.get('/api/health',(_req,res)=>res.json({ok:true,service:'stockpilot-api',mode:process.env.MOCK_MODE==='false'?'shopify':'demo'}));app.use('/api/dashboard',requireShopifyAuth,dashboardRouter);app.use('/api/restock-plans',requireShopifyAuth,restockRouter);app.use('/api/sync',requireShopifyAuth,syncRouter);app.use('/api/auth',authRouter);app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{console.error(err);res.status(500).json({error:'Internal server error'});});const port=Number(process.env.PORT??4000);app.listen(port,()=>console.log(`StockPilot API listening on http://localhost:${port}`));