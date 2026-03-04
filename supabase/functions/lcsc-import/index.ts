const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { partNumber } = await req.json();

    if (!partNumber) {
      return new Response(
        JSON.stringify({ success: false, error: 'Part number is required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanPart = partNumber.trim().toUpperCase();

    // Use LCSC's product detail API for exact part lookup
    const detailUrl = `https://wmsc.lcsc.com/ftps/wanna/search/part?searchContent=${encodeURIComponent(cleanPart)}&currentPage=1&pageSize=20`;

    const res = await fetch(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.lcsc.com/',
      },
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `LCSC API returned ${res.status}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await res.json();

    // Navigate nested result structure
    const productList =
      data?.result?.productSearchResultVO?.productList ||
      data?.result?.productList ||
      data?.productList ||
      [];

    if (!productList.length) {
      return new Response(
        JSON.stringify({ success: false, error: `No product found for: ${cleanPart}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STRICT exact match on the LCSC part number — don't fall back to wrong parts
    const exactMatch = productList.find((p: any) => {
      const lcscPart = (p.lcscPart || p.productCode || p.mpn || '').replace(/\s/g, '').toUpperCase();
      return lcscPart === cleanPart;
    });

    if (!exactMatch) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Part "${cleanPart}" not found. Make sure the LCSC part number is correct (e.g. C93216).`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const product = exactMatch;

    // Extract specifications
    const paramList = product.paramVOList || product.paramList || [];
    const specifications: Record<string, string> = {};
    for (const param of paramList) {
      const key = param.paramNameEn || param.paramName || param.name;
      const value = param.paramValueEn || param.paramValue || param.value;
      if (key && value && key !== '-' && value !== '-' && key !== 'undefined') {
        specifications[key] = String(value);
      }
    }

    const categoryPath = product.parentCatalogName || product.catalogName || '';
    const packageType = product.encapStandard || product.packageModel || specifications['Package'] || '';
    const manufacturer = product.brandNameEn || product.brandName || '';

    const descParts = [
      categoryPath && `Category: ${categoryPath}`,
      manufacturer && `Manufacturer: ${manufacturer}`,
      packageType && `Package: ${packageType}`,
    ].filter(Boolean);
    const description = descParts.join(' | ');

    const images: string[] = [];
    if (product.productImgUrl) images.push(product.productImgUrl);
    if (product.productImages && Array.isArray(product.productImages)) {
      images.push(...product.productImages);
    }

    const datasheetUrl = product.dataManualUrl || product.pdfUrl || product.datasheetUrl || '';
    const productCode = product.productCode || product.lcscPart || cleanPart;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          name: product.productModel || product.mpn || cleanPart,
          sku: product.lcscPart || cleanPart,
          description,
          manufacturer,
          package: packageType,
          datasheet_url: datasheetUrl,
          images,
          specifications,
          lcsc_url: `https://www.lcsc.com/product-detail/${productCode}.html`,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('lcsc-import error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Failed to fetch LCSC data' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
