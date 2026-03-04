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

    // Try LCSC search API
    const searchUrl = `https://wmsc.lcsc.com/ftps/wanna/search/part?searchContent=${encodeURIComponent(cleanPart)}`;
    
    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; product-import)',
        'Accept': 'application/json',
      },
    });

    if (!searchRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `LCSC API returned ${searchRes.status}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchData = await searchRes.json();

    // Find the product that matches the part number exactly
    const productList = searchData?.result?.productSearchResultVO?.productList || 
                       searchData?.result?.productList || 
                       [];

    if (!productList.length) {
      return new Response(
        JSON.stringify({ success: false, error: `No product found for part number: ${cleanPart}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to find exact match, fallback to first result
    const product = productList.find((p: any) => 
      (p.lcscPart || p.productCode || '').toUpperCase() === cleanPart
    ) || productList[0];

    // Extract specifications from paramVOList or paramList
    const paramList = product.paramVOList || product.paramList || [];
    const specifications: Record<string, string> = {};
    for (const param of paramList) {
      const key = param.paramNameEn || param.paramName || param.name;
      const value = param.paramValueEn || param.paramValue || param.value;
      if (key && value && key !== '-' && value !== '-') {
        specifications[key] = value;
      }
    }

    // Build description from category + package + manufacturer
    const categoryPath = product.parentCatalogName || product.catalogName || '';
    const packageType = product.encapStandard || product.packageModel || specifications['Package'] || '';
    const manufacturer = product.brandNameEn || product.brandName || '';
    const descParts = [
      categoryPath && `Category: ${categoryPath}`,
      manufacturer && `Manufacturer: ${manufacturer}`,
      packageType && `Package: ${packageType}`,
    ].filter(Boolean);
    const description = descParts.join(' | ');

    // Images
    const images: string[] = [];
    if (product.productImgUrl) images.push(product.productImgUrl);
    if (product.images && Array.isArray(product.images)) {
      images.push(...product.images);
    }

    // Datasheet URL
    const datasheetUrl = product.dataManualUrl || product.pdfUrl || product.datasheetUrl || '';

    const result = {
      success: true,
      data: {
        name: product.productModel || product.productCode || cleanPart,
        sku: product.lcscPart || product.productCode || cleanPart,
        description,
        manufacturer,
        package: packageType,
        datasheet_url: datasheetUrl,
        images,
        specifications,
        lcsc_url: `https://www.lcsc.com/product-detail/${product.productCode || cleanPart}.html`,
      },
    };

    return new Response(
      JSON.stringify(result),
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
