exports.handler = async (event) => {
  // CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const adminPassword = process.env.ADMIN_PASSWORD;
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO;

  const authHeader = event.headers.authorization;
  if (!adminPassword || authHeader !== `Bearer ${adminPassword}`) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'No autorizado. Verifica la contraseña.' }) };
  }

  if (!githubToken || !githubRepo) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Falta configurar GITHUB_TOKEN o GITHUB_REPO en Netlify.' }) };
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body);
      if (!Array.isArray(body.products)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Formato de datos inválido.' }) };

      const url = `https://api.github.com/repos/${githubRepo}/contents/productos.json`;
      
      // 1. Obtener SHA del archivo actual
      const getRes = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Mallavia-Admin'
        }
      });
      
      if (!getRes.ok && getRes.status !== 404) {
        throw new Error('No se pudo leer el repositorio. Verifica tu GITHUB_TOKEN y GITHUB_REPO.');
      }
      
      let sha = null;
      if (getRes.ok) {
        const fileData = await getRes.json();
        sha = fileData.sha;
      }

      // 2. Escribir el nuevo archivo
      const contentBase64 = Buffer.from(JSON.stringify(body.products, null, 2)).toString('base64');
      
      const putRes = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mallavia-Admin'
        },
        body: JSON.stringify({
          message: 'Actualización del catálogo de vinos (Vía Panel Admin)',
          content: contentBase64,
          sha: sha
        })
      });

      if (!putRes.ok) {
        const errInfo = await putRes.text();
        console.error("Github error:", errInfo);
        throw new Error('Error al escribir en GitHub. Verifica permisos del token.');
      }

      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Guardado con éxito.' }) };

    } catch (error) {
      console.error(error);
      return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
  }

  return { statusCode: 405, headers, body: 'Método no permitido' };
};
