async function testReceiveScan() {
  try {
    const productsRes = await fetch('http://localhost:4004/inventory?limit=1');
    const productsJson = await productsRes.json();
    const product = productsJson.data[0];
    
    console.log('Product:', JSON.stringify(product, null, 2));

  } catch (e) {
    console.error(e);
  }
}

testReceiveScan();
