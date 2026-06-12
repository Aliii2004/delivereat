import Redis from 'ioredis';
import crypto from 'crypto';

// MUHIM: pub/sub uchun ALOHIDA connection kerak
// Bitta connection da SUBSCRIBE chiqqandan keyin
// boshqa Redis buyruqlarini bajara olmaydi
class RedisService {
  public client: Redis;
  private publisher: Redis;
  private subscriber: Redis;

  constructor() {
    // FIX: Redis password support qo'shildi
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    const redisOptions = {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      // Password ENV dan olinadi (format: redis://:password@host:port)
    };

    this.client     = new Redis(redisUrl, redisOptions);
    this.publisher  = new Redis(redisUrl, redisOptions);
    this.subscriber = new Redis(redisUrl, redisOptions);

    this.client.on('error',     (err) => console.error('Redis client error:', err));
    this.publisher.on('error',  (err) => console.error('Redis publisher error:', err));
    this.subscriber.on('error', (err) => console.error('Redis subscriber error:', err));
  }

  async connect() {
    await Promise.all([
      this.client.connect(),
      this.publisher.connect(),
      this.subscriber.connect(),
    ]);
  }

  async disconnect() {
    await Promise.all([
      this.client.quit(),
      this.publisher.quit(),
      this.subscriber.quit(),
    ]);
  }

  // ─── ODDIY OPERATSIYALAR ─────────────────────────────────

  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string) {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  // ─── KURYER JOYLASHUVI ────────────────────────────────────

  async setCourierLocation(courierId: string, lat: number, lng: number) {
    const key   = `courier:${courierId}:location`;
    const value = JSON.stringify({ lat, lng, updatedAt: new Date().toISOString() });
    // FIX: TTL 5 daqiqaga oshirildi — kuryer signal bermasa offline hisoblanadi
    await this.client.setex(key, 300, value);
  }

  async getCourierLocation(courierId: string) {
    const data = await this.client.get(`courier:${courierId}:location`);
    return data ? JSON.parse(data) : null;
  }

  // ─── BUYURTMA HOLATI CACHE ────────────────────────────────

  async setOrderStatus(orderId: string, status: string) {
    // TTL: 24 soat — yetkazilgan buyurtma ertasiga arxivlanadi
    await this.client.setex(`order:${orderId}:status`, 86400, status);
  }

  async getOrderStatus(orderId: string): Promise<string | null> {
    return this.client.get(`order:${orderId}:status`);
  }

  // ─── JWT BLACKLIST ────────────────────────────────────────
  // FIX: to'liq tokenni saqlash o'rniga SHA-256 hash saqlanadi
  // Token uzunligi 300+ belgi — Redis da to'g'ridan saqlash xotira isrof qiladi
  // Hash 64 belgi — bir xil TTL, kam xotira

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async blacklistToken(token: string, expiresIn: number) {
    const hash = this.hashToken(token);
    await this.client.setex(`blacklist:${hash}`, expiresIn, '1');
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const hash = this.hashToken(token);
    return this.exists(`blacklist:${hash}`);
  }

  // ─── PUB/SUB ─────────────────────────────────────────────

  async publish(channel: string, message: object) {
    await this.publisher.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, callback: (message: object) => void) {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        try {
          callback(JSON.parse(msg));
        } catch (e) {
          console.error('Redis message parse error:', e);
        }
      }
    });
  }
}

export const redisService = new RedisService();
