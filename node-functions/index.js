// TMDB Proxy for EdgeOne Pages - 修复401问题

export const onRequest = async (context) => {
  try {
    const { request, env } = context;
    
    console.log('Request received:', request.url);
    console.log('Request method:', request.method);
    
    // 处理OPTIONS请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
        },
      });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    
    console.log('Processing path:', pathname);
    
    // 从请求中获取API Key
    const API_KEY = request.headers.get('X-API-Key') || 
                   url.searchParams.get('api_key') || 
                   url.searchParams.get('key');

    // 获取客户端IP
    let clientIp = 'unknown';
    try {
      clientIp = request.headers.get('eo-connecting-ip') || 
                 request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                 'unknown';
    } catch (e) {
      console.log('IP detection error:', e);
    }

    // 健康检查端点 - 无需认证
    if (pathname === '/health' || pathname === '/ping') {
      return new Response(JSON.stringify({
        status: 'ok',
        platform: 'EdgeOne Pages',
        timestamp: new Date().toISOString(),
        client_ip: clientIp,
        version: '1.0.1-EdgeOne-AuthFix',
        path: pathname,
        method: request.method
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 根路径 - 返回简单的欢迎页面而不是404
    if (pathname === '/' || pathname === '') {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TMDB Proxy Service</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f2f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .title { font-size: 28px; color: #333; margin-bottom: 20px; }
        .status { font-size: 18px; color: #28a745; margin-bottom: 30px; }
        .endpoints { text-align: left; background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .endpoint { margin: 10px 0; font-family: monospace; }
        .note { font-size: 14px; color: #666; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="title">🎬 TMDB Proxy Service</div>
        <div class="status">✅ Service is running on EdgeOne Pages</div>
        
        <div class="endpoints">
            <h3>Available Endpoints:</h3>
            <div class="endpoint">• <strong>/health</strong> - Health check</div>
            <div class="endpoint">• <strong>/t/p/{size}/{path}</strong> - Image proxy</div>
            <div class="endpoint">• <strong>/3/{endpoint}</strong> - API proxy (requires API key)</div>
            <div class="endpoint">• <strong>/admin/status</strong> - Admin status (requires API key)</div>
        </div>
        
        <div class="note">
            <p><strong>API Key Methods:</strong></p>
            <p>• Header: <code>X-API-Key: your_api_key</code></p>
            <p>• URL Parameter: <code>?api_key=your_api_key</code></p>
        </div>
        
        <div class="note">
            <p>Powered by EdgeOne Pages | Version 1.0.1</p>
        </div>
    </div>
    
    <script>
        console.log('🎬 TMDB Proxy Service - EdgeOne Pages');
        console.log('Status: ✅ Running');
        console.log('Platform: EdgeOne Pages');
        console.log('Version: 1.0.1-AuthFix');
        
        // 测试函数
        window.testHealth = () => fetch('/health').then(r=>r.json()).then(console.log);
        window.testImage = () => { 
          const img = new Image(); 
          img.onload = () => console.log('✅ Image proxy working'); 
          img.onerror = () => console.log('❌ Image proxy failed'); 
          img.src = '/t/p/w500/bcP7FtskwsNp1ikpMQJzDPjofP5.jpg'; 
        };
        
        console.log('Test functions: testHealth(), testImage()');
    </script>
</body>
</html>`;
      
      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 管理端点
    if (pathname === '/admin/status') {
      if (!API_KEY || API_KEY.length !== 32) {
        return new Response(JSON.stringify({
          error: 'API Key required',
          message: 'Please provide a valid TMDB API Key'
        }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      return new Response(JSON.stringify({
        status: 'active',
        version: '1.0.1-EdgeOne-TMDB',
        platform: 'EdgeOne Pages',
        endpoints: { 
          images: '/t/p/{size}/{path}', 
          api: '/3/{endpoint}',
          health: '/health',
          admin: '/admin/status'
        },
        client_info: { 
          ip: clientIp,
          user_agent: request.headers.get('User-Agent')?.substring(0, 50) || 'unknown'
        },
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 图片代理 /t/p/*
    if (pathname.startsWith('/t/p/')) {
      try {
        const imageUrl = `https://image.tmdb.org${pathname}`;
        console.log('Proxying image:', imageUrl);
        
        const response = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; EdgeOne-TMDB-Proxy/1.0)',
            'Accept': 'image/*'
          }
        });

        if (!response.ok) {
          console.log('Image not found:', response.status);
          return new Response('Image not found', {
            status: 404,
            headers: {
              'Content-Type': 'text/plain',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

        // 创建新响应
        const newResponse = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });

        // 添加CORS和缓存头部
        newResponse.headers.set("Access-Control-Allow-Origin", "*");
        newResponse.headers.set("Cache-Control", "public, max-age=604800, immutable");

        return newResponse;
      } catch (error) {
        console.error('Image proxy error:', error);
        return new Response('Image proxy error', {
          status: 500,
          headers: {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    // API代理 /3/*
    if (pathname.startsWith('/3/')) {
      // 检查API Key
      if (!API_KEY) {
        return new Response(JSON.stringify({
          error: 'API Key required',
          message: 'Please provide a valid TMDB API Key via header X-API-Key or URL parameter api_key'
        }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      try {
        const apiUrl = new URL(`https://api.tmdb.org${pathname}${url.search}`);
        
        // 自动添加API Key
        if (!apiUrl.searchParams.has('api_key')) {
          apiUrl.searchParams.set('api_key', API_KEY);
        }

        console.log('Proxying API:', apiUrl.toString());

        const response = await fetch(apiUrl.toString(), {
          method: request.method,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; EdgeOne-TMDB-Proxy/1.0)'
          },
          body: request.method !== 'GET' ? request.body : undefined,
        });

        // 创建新响应
        const newResponse = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });

        // 添加CORS头部
        newResponse.headers.set("Access-Control-Allow-Origin", "*");
        newResponse.headers.set("Content-Type", "application/json");
        
        // 智能缓存控制
        const cacheTime = pathname.includes('configuration') ? 3600 : 
                         pathname.includes('search') ? 300 : 
                         pathname.includes('popular') ? 1800 : 600;
        newResponse.headers.set("Cache-Control", `public, max-age=${cacheTime}`);

        return newResponse;
      } catch (error) {
        console.error('API proxy error:', error);
        return new Response(
          JSON.stringify({ error: 'API request failed', message: error.message }),
          {
            status: 502,
            headers: {
              "content-type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    // 其他路径返回友好的404
    return new Response(JSON.stringify({
      error: 'Not Found',
      message: 'The requested endpoint was not found',
      available_endpoints: ['/health', '/t/p/{size}/{path}', '/3/{endpoint}', '/admin/status']
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Global error:', error);
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};
