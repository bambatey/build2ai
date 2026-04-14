export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const documentType = query.document_type || '1';

    console.log('Server route received query:', query);
    console.log('Document type:', documentType);

    const url = `https://structapp.xyz/documents?document_type=${documentType}`;
    console.log('Fetching from:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log('Backend response status:', response.status);

    const data = await response.json();
    console.log('Backend response data:', data);

    if (!response.ok) {
      throw new Error(`Backend request failed: ${response.statusText}`);
    }

    return data;
  } catch (error) {
    console.error('Error fetching documents:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch documents'
    });
  }
});
