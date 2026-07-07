---
# 文章标题
title: RedisCache
# 文章发布日期
published: 2026-07-06
# 文章简介
description: RedisCache
# 文章标签
tags: [Redis]
# 文章分类
category: Redis
# 是否为草稿
draft: true
# 是否置顶
pinned: false
# 是否允许评论
comments: true
# 文章密码，不需要加密就留空
---


缓存：数据交换的缓冲区，存储数据的临时区域，一般读写性能较高
浏览器缓存(浏览器)——>应用层缓存(tomcat)——>数据库缓存(数据库)——>CPU缓存，硬盘缓存 

作用：降低后端负载，提高读写效率，降低响应时间
成本：数据一致性成本，代码维护成本，运维成本


添加Redis缓存

缓存作用模型


代码示例：
    public Result queryById(Long id) {
        String key = "cache:shop"+id;
        // 1.从redis查询商铺缓存
        String shopJson = stringRedisTemplate.opsForValue().get(key);
        // 2.判断是否存在
        if(StrUtil.isNotEmpty(shopJson)) {
            // 3.存在，直接返回
            Shop shop = JSONUtil.toBean(shopJson, Shop.class);
            return Result.ok(shop);
        }

        // 4.不存在，根据id查询数据库
        Shop shop = getById(id);
        // 5.不存在，返回错误
        if(shop == null) {
            return Result.fail("商铺不存在");
        }
        // 6.存在，写入redis
        stringRedisTemplate.opsForValue().set(key ,JSONUtil.toJsonStr(shop));
        return Result.ok(shop);
    }

缓存更新策略


给查询商铺的缓存添加超时剔除和主动更新策略

    stringRedisTemplate.opsForValue().set(key ,JSONUtil.toJsonStr(shop),30L, TimeUnit.MINUTES);


    @Transactional()
    public Result update(Shop shop) {
        Long id = shop.getId();
        if(id == null) {
            return Result.fail("店铺id不能为空");
        }
        // 1.更新数据库
        updateById(shop);
        // 2.删除缓存
        stringRedisTemplate.delete("cache:shop"+shop.getId());
        return Result.ok();
    }


缓存穿透
是指客户端请求的数据在缓存中和数据库中都不存在，这一缓存永远不会生效，这些请求都会到达数据库

解决方法
缓存空对象
优点：实现简单，维护方便
缺点：额外的内存消耗，可能造成短期的不一致

布隆过滤
优点：内存占用率较少，没有多余key
缺点：实现复杂，存在误判可能


        // 判断命中的是否是空值
        if(shopJson != null) {
            // 返回错误信息
            return Result.fail("商铺不存在");
        }
        // 


        // 5.不存在，返回错误
        if(shop == null) {
            // 将空值写入redis
            stringRedisTemplate.opsForValue().set(key,"",2L, TimeUnit.MINUTES);
            return Result.fail("商铺不存在");
        }

缓存雪崩
是指在同一时段大量的缓存key同时实效或者Redis服务宕机，导致大量请求到达数据库，带来巨大压力

解决方法
给不同的key的ttl添加随机值，利用redis集群提高服务的可用性，给缓存业务添加降级限流策略，给业务添加多级缓存


缓存击穿
也叫热点key问题，就是一个呗高并发访问并且缓存重建业务较复杂的key突然失效，无数的请求访问会在瞬间给数据库带来巨大的冲击

解决方法
互斥锁：优点：没有额外的内存消耗，保证一致性，实现简单
    缺点：线程需要等待，性能受影响，可能有死锁风险
逻辑过期：优点：线程无需等待，性能较好
    缺点：不保证一致性，有额外内存消耗，实现复杂

基于互斥锁方式解决缓存击穿问题
    @Override
    public Result queryById(Long id) {

        //缓存穿透
        //Shop shop = queryWithPassThrough(id);

        //互斥锁解决缓存击穿
        Shop shop = queryWithMutex(id);
        if (shop == null) {
            return Result.fail("店铺不存在");
        }
        // 返回
        return Result.ok(shop);
    }

    public Shop queryWithPassThrough(Long id) {
        String key = "cache:shop"+id;
        // 1.从redis查询商铺缓存
        String shopJson = stringRedisTemplate.opsForValue().get(key);
        // 2.判断是否存在
        if(StrUtil.isNotEmpty(shopJson)) {
            // 3.存在，直接返回
            Shop shop = JSONUtil.toBean(shopJson, Shop.class);
            return shop;
        }

        // 4.判断命中的是否是空值
        if(shopJson != null) {
            // 返回错误信息
            return null;
        }
        // 5.不存在，根据id查询数据库
        Shop shop = getById(id);
        // 6.不存在，返回错误
        if(shop == null) {
            // 将空值写入redis
            stringRedisTemplate.opsForValue().set(key,"",2L, TimeUnit.MINUTES);
            return null;
        }
        // 7.存在，写入redis
        stringRedisTemplate.opsForValue().set(key ,JSONUtil.toJsonStr(shop),30L, TimeUnit.MINUTES);
        // 8.返回
        return shop;
    }

    public Shop queryWithMutex(Long id) {
        String key = "cache:shop"+id;
        // 1.从redis查询商铺缓存
        String shopJson = stringRedisTemplate.opsForValue().get(key);

        // 2.判断是否存在
        if(StrUtil.isNotEmpty(shopJson)) {
            // 3.存在，直接返回
            Shop shop = JSONUtil.toBean(shopJson, Shop.class);
            return shop;
        }

        // 4.判断命中的是否是空值
        if(shopJson != null) {
            // 返回错误信息
            return null;
        }
        // 5实现缓存重建
        // 5.1获取互斥锁
        String lockKey = "lock:lock:"+id;
        Shop shop = null;
        try {
            boolean isLock = tryLock(lockKey);

            // 5.2判断是否获取成功
            if(!isLock) {
                // 5.3获取失败，休眠并重试
                Thread.sleep(50);
                return queryWithPassThrough(id);
            }

            // 5.4成功，根据id查询数据库
            shop = getById(id);
            // 6.不存在，返回错误
            if(shop == null) {
                // 将空值写入redis
                stringRedisTemplate.opsForValue().set(key,"",2L, TimeUnit.MINUTES);
                return null;
            }
            // 7.存在，写入reids
            stringRedisTemplate.opsForValue().set(key ,JSONUtil.toJsonStr(shop),30L, TimeUnit.MINUTES);
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }finally {
            // 8. 释放互斥锁
            unLock(lockKey);
        }
        // 9.返回
        return shop;
    }

    private boolean tryLock(String key) {
        Boolean flag = stringRedisTemplate.opsForValue().setIfAbsent(key, "1", 10, TimeUnit.SECONDS);
        return BooleanUtil.isTrue(flag);
    }

    private void unLock(String key) {
        stringRedisTemplate.delete(key);
    }


基于逻辑过期方式解决缓存击穿问题
@Data
public class RedisData {
    private LocalDateTime expireTime;
    private Object data;
}


    public void saveShop2Redis(Long id,Long expireSeconds) {
        // 1.查询店铺数据
        Shop shop = getById(id);
        // 2.封装逻辑过期时间
        RedisData redisData = new RedisData();
        redisData.setData(shop);
        redisData.setExpireTime(LocalDateTime.now().plusSeconds(expireSeconds));
        // 3.写入redis
        stringRedisTemplate.opsForValue().set("cache:shop"+id,JSONUtil.toJsonStr(redisData));
    }



class HmDianPingApplicationTests {

    @Resource
    private ShopServiceImpl shopService;

    @Test
    void testSaveShop() {
        shopService.saveShop2Redis(1L,10L);
    }

}




    private static final ExecutorService CACHE_REBUILD_EXECUTOR = Executors.newFixedThreadPool(10);

    public Shop queryWithLogicalExpire(Long id) {
        String key = "cache:shop"+id;
        // 1.从redis查询商铺缓存
        String shopJson = stringRedisTemplate.opsForValue().get(key);

        // 2.判断是否存在
        if(StrUtil.isEmpty(shopJson)) {
            // 3.存在，直接返回
            return null;
        }

        // 4.命中，需要把Json反序列化为对象
        RedisData redisData = JSONUtil.toBean(shopJson, RedisData.class);
        JSONObject data = (JSONObject) redisData.getData();
        Shop shop = JSONUtil.toBean(data, Shop.class);
        LocalDateTime expireTime = redisData.getExpireTime();
        // 5.判断是否过期
        if(expireTime.isAfter(LocalDateTime.now())) {
            // 5.1未过期，直接返回店铺信息
            return shop;
        }
        // 5.2已过期，需要缓存重建
        // 6.缓存重建
        // 6.1获取互斥锁
        String lockKey = "lock:shop:"+id;
        boolean isLock = tryLock(lockKey);

        // 6.2判断是否获取锁成功
        if(isLock) {
            // 6.3成功，开启独立线程，实现缓存重建
            CACHE_REBUILD_EXECUTOR.execute(() -> {
                try {
                    // 重建缓存
                    this.saveShop2Redis(id,30L);
                } catch (Exception e) {
                    throw new RuntimeException(e);
                } finally {
                    // 释放锁
                    unLock(lockKey);

                }
            });
        }
        // 6.4返回过期的店铺信息
        return shop;
    }


缓存工具封装
@Component
@Slf4j
public class CacheClient {

    private final StringRedisTemplate stringRedisTemplate;

    public CacheClient(StringRedisTemplate stringRedisTemplate) {
        this.stringRedisTemplate = stringRedisTemplate;
    }

    public void set(String key, Object value, Long time, TimeUnit timeUnit) {
        stringRedisTemplate.opsForValue().set(key, JSONUtil.toJsonStr(value), time, timeUnit);
    }

    public void setWithLogicalExpire(String key, Object value, Long time, TimeUnit timeUnit) {
        // 设置逻辑过期
        RedisData redisData = new RedisData();
        redisData.setData(value);
        redisData.setExpireTime(LocalDateTime.now().plusSeconds(time));
        // 写入redis
        stringRedisTemplate.opsForValue().set(key, JSONUtil.toJsonStr(value));
    }
    public <R,ID> R queryWithPassThrough(
            String keyPrefix, ID id, Class<R> type, Function<ID,R> deFallback, Long time, TimeUnit timeUnit) {
        String key = keyPrefix+id;
        // 1.从redis查询商铺缓存
        String shopJson = stringRedisTemplate.opsForValue().get(key);
        // 2.判断是否存在
        if(StrUtil.isNotEmpty(shopJson)) {
            // 3.存在，直接返回
            return JSONUtil.toBean(shopJson, type);
        }

        // 4.判断命中的是否是空值
        if(shopJson != null) {
            // 返回错误信息
            return null;
        }
        // 5.不存在，根据id查询数据库
        R r = deFallback.apply(id);
        // 6.不存在，返回错误
        if(r == null) {
            // 将空值写入redis
            stringRedisTemplate.opsForValue().set(key,"",2L, TimeUnit.MINUTES);
            return null;
        }
        // 7.存在，写入redis
        this.set(key, r, time, timeUnit);
        // 8.返回
        return r;
    }

    private static final ExecutorService CACHE_REBUILD_EXECUTOR = Executors.newFixedThreadPool(10);

    public <R,ID> R queryWithLogicalExpire(
            String keyPrefix, ID id, Class<R> type, Function<ID,R> deFallback, Long time, TimeUnit timeUnit) {
        String key = keyPrefix+id;
        // 1.从redis查询商铺缓存
        String shopJson = stringRedisTemplate.opsForValue().get(key);

        // 2.判断是否存在
        if(StrUtil.isEmpty(shopJson)) {
            // 3.存在，直接返回
            return null;
        }

        // 4.命中，需要把Json反序列化为对象
        RedisData redisData = JSONUtil.toBean(shopJson, RedisData.class);
        R r = JSONUtil.toBean((JSONObject) redisData.getData(),type);
        LocalDateTime expireTime = redisData.getExpireTime();
        // 5.判断是否过期
        if(expireTime.isAfter(LocalDateTime.now())) {
            // 5.1未过期，直接返回店铺信息
            return r;
        }
        // 5.2已过期，需要缓存重建
        // 6.缓存重建
        // 6.1获取互斥锁
        String lockKey = "lock:shop:"+id;
        boolean isLock = tryLock(lockKey);

        // 6.2判断是否获取锁成功
        if(isLock) {
            // 6.3成功，开启独立线程，实现缓存重建
            CACHE_REBUILD_EXECUTOR.execute(() -> {
                try {
                    // 查询数据库
                    R r1 = deFallback.apply(id);
                    //写入redis
                    this.setWithLogicalExpire(key, r1, time, timeUnit);
                } catch (Exception e) {
                    throw new RuntimeException(e);
                } finally {
                    // 释放锁
                    unLock(lockKey);

                }
            });
        }
        // 6.4返回过期的店铺信息
        return r;
    }

    private boolean tryLock(String key) {
        Boolean flag = stringRedisTemplate.opsForValue().setIfAbsent(key, "1", 10, TimeUnit.SECONDS);
        return BooleanUtil.isTrue(flag);
    }

    private void unLock(String key) {
        stringRedisTemplate.delete(key);
    }
}





    @Override
    public Result queryById(Long id) {

        // 缓存穿透
        //Shop shop = queryWithPassThrough(id);
//        Shop shop = cacheClient.queryWithPassThrough(
//                RedisConstants.CACHE_SHOP_KEY,id, Shop.class,this::getById,RedisConstants.CACHE_SHOP_TTL,TimeUnit.MINUTES
//        );
        // 互斥锁解决缓存击穿
        //Shop shop = queryWithMutex(id);

        // 逻辑过期解决缓存击穿
        //Shop shop = queryWithLogicalExpire(id);
        Shop shop = cacheClient.queryWithLogicalExpire(
                RedisConstants.CACHE_SHOP_KEY,id,Shop.class,this::getById,RedisConstants.CACHE_SHOP_TTL,TimeUnit.MINUTES
        );

        if (shop == null) {
            return Result.fail("店铺不存在");
        }
        // 返回
        return Result.ok(shop);
    }



@SpringBootTest
class HmDianPingApplicationTests {

    @Resource
    private ShopServiceImpl shopService;

    @Resource
    private CacheClient cacheClient;


    @Test
    void testSaveShop() {
        Shop shop = shopService.getById(1L);
        cacheClient.setWithLogicalExpire(RedisConstants.CACHE_SHOP_KEY+1L,shop,10L, TimeUnit.SECONDS);
    }

}