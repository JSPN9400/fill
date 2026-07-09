# Milan — Static Frontend (HTML + CSS + JS, no build step)

Ye plain HTML/CSS/JS version hai — koi `npm install` ya build step nahi chahiye. GitHub Pages jaisi free static hosting pe seedha chal jayega.

## Local test karne ke liye
Sirf `index.html` ko double-click karke browser me mat kholna (camera permission `file://` pe kaam nahi karega). Local server chalao:

```bash
cd dating-app-static
python3 -m http.server 8080
```
Phir `http://localhost:8080` kholo.

(Ya VS Code me "Live Server" extension use kar lo.)

## Backend URL set karo
`app.js` file ke top pe:
```js
const API_BASE_URL = 'http://localhost:5034/api/auth';
```
Local test ke liye apne backend ka port daalo. **Render pe deploy karne ke baad**, ye badal ke apna Render URL daalna:
```js
const API_BASE_URL = 'https://your-app-name.onrender.com/api/auth';
```

## GitHub Pages pe deploy karna
1. Is `dating-app-static` folder ko apne GitHub repo me push karo
2. GitHub repo → **Settings → Pages**
3. "Source" me apni branch (`main`) aur folder (`/dating-app-static` ya root, jahan bhi ye files hain) select karo
4. Save karo — kuch minute me URL milega jaisa `https://<username>.github.io/<repo>/`

⚠️ **Zaroori**: GitHub Pages HTTPS pe serve karta hai, aur camera access (`getUserMedia`) sirf HTTPS ya localhost pe kaam karta hai — GitHub Pages HTTPS hi deta hai, to face-scan step yaha bhi kaam karega.

## Backend CORS note
Backend ka `cors()` abhi open hai (sab origins allow), to GitHub Pages se request aane me koi dikkat nahi hogi. Jab real launch karoge, `app.js` (backend) me CORS ko apne actual domain tak restrict karna best practice hoga.
