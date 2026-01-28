// Native fetch is available in Node 18+

const API_KEY = '05bf6824054442059c0bc2123bffbfae';
const ADDRESS = '11660 Hidden Hollow Cir, Tampa, FL 33635';

async function test() {
    const url = `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(ADDRESS)}`;

    try {
        const response = await fetch(url, {
            headers: {
                'X-Api-Key': API_KEY,
                'Accept': 'application/json'
            }
        });

        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}

test();
