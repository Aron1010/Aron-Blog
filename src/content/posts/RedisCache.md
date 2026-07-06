---
# 文章标题
title: 文章标题
# 文章发布日期
published: 2026-07-06
# 文章简介
description: 文章简介
# 文章标签
tags: [Redis]
# 文章分类
category: 随笔
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