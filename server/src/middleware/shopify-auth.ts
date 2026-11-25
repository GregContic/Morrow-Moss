import type {Request,Response,NextFunction} from 'express';
import {createHmac,timingSafeEqual} from 'node:crypto';

declare global { namespace Express { interface Request { shopDomain?: string } } }

export function requireShopifyAuth(req:Request,res:Response,next:NextFunction){
  if(process.env.MOCK_MODE!=='false') return next();
  const header=req.headers.authorization;
  const token=header?.startsWith('Bearer ')?header.slice(7):'';
  const secret=process.env.SHOPIFY_API_SECRET;
  const clientId=process.env.SHOPIFY_API_KEY;
  if(!token||!secret||!clientId) return res.status(401).json({error:'Shopify authentication required'});
  try{
    const [encodedHeader,encodedPayload,signature]=token.split('.');
    if(!encodedHeader||!encodedPayload||!signature) throw new Error('Malformed token');
    const jwtHeader=JSON.parse(Buffer.from(encodedHeader,'base64url').toString()) as {alg?:string};
    const claims=JSON.parse(Buffer.from(encodedPayload,'base64url').toString()) as {aud?:string|string[];dest?:string;iss?:string;exp?:number};
    if(jwtHeader.alg!=='HS256') throw new Error('Unexpected signing algorithm');
    const expected=createHmac('sha256',secret).update(`${encodedHeader}.${encodedPayload}`).digest();
    const actual=Buffer.from(signature,'base64url');
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected)) throw new Error('Invalid signature');
    const aud=Array.isArray(claims.aud)?claims.aud:[claims.aud];
    if(!aud.includes(clientId)||!claims.exp||claims.exp<=Math.floor(Date.now()/1000)) throw new Error('Expired or incorrect audience');
    const dest=new URL(claims.dest??'');
    const shop=dest.hostname;
    if(dest.protocol!=='https:'||!shop.endsWith('.myshopify.com')||shop.split('.').length!==3||claims.iss!==`https://${shop}/admin`) throw new Error('Invalid shop issuer');
    req.shopDomain=shop;
    next();
  }catch{return res.status(401).json({error:'Invalid Shopify ID token'});}
}
