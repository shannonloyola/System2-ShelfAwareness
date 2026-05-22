async function testReceiveScan() {
  try {
    const res = await fetch('http://localhost:4004/inventory/receive-scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        product_id: '16',
        product_uuid: 'c8d2a0a0-a5d8-4c9a-8f55-cf115cd38ce9',
        increment: 1,
        reserved_stock: 0
      })
    });
    console.log(res.status, await res.text());
  } catch (e) {
    console.error(e);
  }
}

testReceiveScan();
