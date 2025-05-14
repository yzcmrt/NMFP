import { NextRequest, NextResponse } from 'next/server';

// Bu middleware, GameFi subdomain ve path yönlendirmesi için
export function middleware(request: NextRequest) {
  // URL'leri alın
  const url = request.nextUrl.clone();
  const { pathname, host, origin } = url;
  
  // Localhost kontrolü - geliştirme ortamında özel durumlar
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
  
  // GameFi subdomain kontrolü
  const isGamefiSubdomain = 
    host.startsWith('gamefi.') || 
    host.includes('gamefi.needmoneyforporsche.wtf') ||
    // Lokal geliştirme için "gamefi.localhost" desteği
    (isLocalhost && host.startsWith('gamefi.'));
  
  // Geliştirme ortamında detaylı loglar
  if (process.env.NODE_ENV === 'development') {
    console.log('---------------------------------------');
    console.log('Middleware - Host:', host);
    console.log('Middleware - Path:', pathname);
    console.log('Middleware - Origin:', origin);
    console.log('Middleware - Is Localhost:', isLocalhost);
    console.log('Middleware - Is GameFi Subdomain:', isGamefiSubdomain);
    console.log('---------------------------------------');
  }
  
  // 1. GameFi subdomain'de isek ve /gamefi ile başlayan bir yol varsa - bunu düzelt
  if (isGamefiSubdomain && pathname.startsWith('/gamefi')) {
    const newPath = pathname.replace('/gamefi', '') || '/';
    url.pathname = newPath;
    
    console.log('Subdomain yönlendirme: Gereksiz /gamefi yolunu kaldırıyoruz', url.toString());
    return NextResponse.redirect(url);
  }
  
  // 2. Subdomain'de ve normal bir yoldaysak - içeriğe yönlendir
  if (isGamefiSubdomain && !pathname.startsWith('/gamefi')) {
    // Subdomain'deyken /car, /stats vb. yolları /gamefi/ önekini ekleyerek rewrite et
    // Böylece sunucuda bu rotalar bulunabilir
    if (pathname !== '/') { // Ana sayfa değilse
      const newPath = `/gamefi${pathname}`;
      url.pathname = newPath;
      
      console.log('İçerik rewrite: GameFi subdomain üzerinde içeriği gösteriyoruz', url.toString());
      return NextResponse.rewrite(url);
    } else {
      // Subdomain'in ana sayfasında GameFi ana sayfasını göster
      url.pathname = '/gamefi';
      
      console.log('Ana sayfa rewrite: GameFi ana sayfası', url.toString());
      return NextResponse.rewrite(url);
    }
  }
  
  // 3. Ana domain'de isek ve /gamefi yolu ile başlıyorsa - subdomain'e yönlendir
  // NOT: Localhost'ta bu yönlendirmeyi sadece biz istediğimizde yap
  if (!isGamefiSubdomain && pathname.startsWith('/gamefi')) {
    // Localhost'ta subdomain yönlendirmesini atlayalım, aksi takdirde
    // lokal geliştirmede /gamefi rotaları çalışmayacaktır
    if (isLocalhost) {
      // İçeriği direkt göster, subdomain'e yönlendirme
      const response = NextResponse.next();
      // Header'lara bilgiyi temiz bir şekilde string olarak ekle
      response.headers.set('x-is-gamefi-subdomain', 'false');
      response.headers.set('x-original-host', host || '');
      response.headers.set('x-pathname', pathname || '');
      return response;
    }
    
    // Prodüksiyon ortamında ana domain'in /gamefi yolunu subdomain'e yönlendir
    const gamefiPath = pathname.replace('/gamefi', '') || '/';
    const newHost = host.replace('www.', 'gamefi.');
    
    url.host = newHost;
    url.pathname = gamefiPath;
    
    console.log('Ana domain /gamefi yolunu subdomain\'e yönlendiriyoruz', url.toString());
    return NextResponse.redirect(url);
  }
  
  // Normal istek işleme için header bilgilerini ayarla
  const response = NextResponse.next();
  
  // Set ettiğimiz tüm değerlerin string olduğundan emin ol
  // Serileştirme hatalarını önlemek için
  response.headers.set('x-is-gamefi-subdomain', isGamefiSubdomain ? 'true' : 'false');
  response.headers.set('x-original-host', host || '');
  response.headers.set('x-pathname', pathname || '');
  
  return response;
}

// Bu middleware tüm yollar için çalışacak (statik kaynaklar hariç)
export const config = {
  matcher: [
    /*
     * Tüm yolları eşleştirin:
     * - api başlangıçlı olanlar hariç
     * - _next başlangıçlı olanlar hariç
     * - statik dosyalar hariç (favicon, assets, vs)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
}; 