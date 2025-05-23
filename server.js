// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const net = require('net');
const bcrypt = require('bcryptjs');
const cookieSession = require('cookie-session');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Sessions
app.use(cookieSession({
  name: 'session',
  keys: ['secretKey123'], // in productie sterker
  maxAge: 24 * 60 * 60 * 1000, // 1 day
  sameSite: 'lax', // ✅ belangrijk: strikter cookie-beleid
  httpOnly: true,     // ✅ browser kan cookie niet lezen via JS
}));

app.use(express.static(path.join(__dirname, 'public')));

// Directory for zone files
const zonesDir = '/etc/bind/zones';
//Directory for users
const usersPath = path.join(__dirname, 'users.json');
// Directory for BIND config
const bindDir = '/etc/bind/named.conf.local';


// Create default user if no users.json
if (!fs.existsSync(usersPath)) {
  const defaultUser = [{
    username: 'admin',
    password: bcrypt.hashSync('admin123', 10),
    forceChange: true,
    role: 'admin'
  }];
  fs.writeFileSync(usersPath, JSON.stringify(defaultUser, null, 2), 'utf-8');
}

app.use(express.json());
// Serve only static assets (css, js, images)
app.use('/static', express.static(path.join(__dirname, 'public')));

// Custom protected routes for pages
app.get('/', (req, res) => {
  console.log(req.session);
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }
  
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/zone', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }
  
  res.sendFile(path.join(__dirname, 'views', 'zone.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/change-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'change-password.html'));
});

app.get('/users', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'users.html'));
});

// List all users
app.get('/api/users', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const users = JSON.parse(fs.readFileSync(usersPath));
  res.json(users.map(u => ({ username: u.username, role: u.role }))); // Never send passwords!
});

// Create a new user
app.post('/api/users', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const users = JSON.parse(fs.readFileSync(usersPath));
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  users.push({ username, password: hashedPassword, role, forceChange: false });
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

  res.json({ status: 'User created' });
});

// Delete a user
app.delete('/api/users/:username', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const users = JSON.parse(fs.readFileSync(usersPath));
  const updatedUsers = users.filter(u => u.username !== req.params.username);

  if (users.length === updatedUsers.length) {
    return res.status(404).json({ error: 'User not found' });
  }

  fs.writeFileSync(usersPath, JSON.stringify(updatedUsers, null, 2));
  res.json({ status: 'User deleted' });
});




// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Login API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = JSON.parse(fs.readFileSync(usersPath));

  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.user = { username: user.username, role: user.role };
  
  if (user.forceChange) {
    return res.json({ status: 'forceChange' });
  } else {
    return res.json({ status: 'ok' });
  }
});

// Change password API
app.post('/api/change-password', (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const users = JSON.parse(fs.readFileSync(usersPath));
  const user = users.find(u => u.username === req.session.user.username);

  if (!user || !bcrypt.compareSync(oldPassword, user.password)) {
    return res.status(400).json({ error: 'Invalid old password' });
  }

  user.password = bcrypt.hashSync(newPassword, 10);
  user.forceChange = false;

  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf-8');

  res.json({ status: 'Password changed' });
});

// Logout API
app.post('/api/logout', (req, res) => {
  req.session = null;
  res.json({ status: 'Logged out' });
});

// Utility: Simple zone file parser
function simpleParseZone(zoneText) {
  const lines = zoneText.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith(';'));
  const zone = { a: [], aaaa: [], cname: [], ns: [], mx: [], txt: [], srv: [], ptr: [], soa: null };

  for (const line of lines) {
    if (line.startsWith('$ORIGIN')) {
      zone.$origin = line.split(/\s+/)[1].replace(/\.$/, '');
    } else if (line.startsWith('$TTL')) {
      zone.$ttl = parseInt(line.split(/\s+/)[1], 10);
    } else if (line.includes('IN SOA')) {
      const idx = lines.indexOf(line);
      const parts = line.split(/\s+/);
      zone.soa = {
        mname: parts[2],
        rname: parts[3],
        serial: parseInt(lines[idx + 1]),
        refresh: parseInt(lines[idx + 2]),
        retry: parseInt(lines[idx + 3]),
        expire: parseInt(lines[idx + 4]),
        minimum: parseInt(lines[idx + 5].replace(')', ''))
      };
    } else {
      const parts = line.split(/\s+/);
      if (parts.length < 4) continue;

      const [name, , type, ...rest] = parts;

      switch (type) {
        case 'A':
          zone.a.push({ name, ip: rest[0] });
          break;
        case 'AAAA':
          zone.aaaa.push({ name, ip: rest[0] });
          break;
        case 'CNAME':
          zone.cname.push({ name, alias: rest[0] });
          break;
        case 'NS':
          zone.ns.push({ name, host: rest[0] });
          break;
        case 'MX':
          zone.mx.push({ name, preference: parseInt(rest[0], 10), host: rest[1] });
          break;
        case 'TXT':
          zone.txt.push({ name, txt: rest.join(' ').replace(/"/g, '') });
          break;
        case 'SRV':
          zone.srv.push({
            name,
            priority: parseInt(rest[0], 10),
            weight: parseInt(rest[1], 10),
            port: parseInt(rest[2], 10),
            target: rest[3]
          });
          break;
        case 'PTR':
          zone.ptr.push({ name, ip: rest[0] });
          break;
      }
    }
  }

  return zone;
}

// Utility: Generate zone file text
function generateZoneFile(zone) {
  let output = '';

  if (zone.$origin) output += `$ORIGIN ${zone.$origin}.\n`;
  if (zone.$ttl) output += `$TTL ${zone.$ttl}\n`;

  if (zone.soa) {
    output += `@ IN SOA ${zone.soa.mname} ${zone.soa.rname} (\n`;
    output += `  ${zone.soa.serial} ; serial\n`;
    output += `  ${zone.soa.refresh} ; refresh\n`;
    output += `  ${zone.soa.retry} ; retry\n`;
    output += `  ${zone.soa.expire} ; expire\n`;
    output += `  ${zone.soa.minimum} ; minimum ttl\n`;
    output += `)\n`;
  }

  for (const [recordType, entries] of Object.entries(zone)) {
    if (['soa', '$origin', '$ttl'].includes(recordType)) continue; // skip meta info

    const type = recordType.toUpperCase();

    for (const record of entries) {
      if (type === 'A' || type === 'AAAA' || type === 'PTR') {
        output += `${record.name} IN ${type} ${record.ip}\n`;
      } else if (type === 'CNAME') {
        output += `${record.name} IN CNAME ${record.alias}\n`;
      } else if (type === 'NS') {
        output += `${record.name} IN NS ${record.host}\n`;
      } else if (type === 'MX') {
        output += `${record.name} IN MX ${record.preference} ${record.host}\n`;
      } else if (type === 'TXT') {
        output += `${record.name} IN TXT "${record.txt}"\n`;
      } else if (type === 'SRV') {
        output += `${record.name} IN SRV ${record.priority} ${record.weight} ${record.port} ${record.target}\n`;
      }
    }
  }

  return output;
}





// Utility: Load zone file safely
function loadZone(zoneName) {
  const zonePath = path.join(zonesDir, `${zoneName}.zone`);
  if (!fs.existsSync(zonePath)) throw new Error('Zone file not found');
  const zoneText = fs.readFileSync(zonePath, 'utf-8');
  return simpleParseZone(zoneText);
}

// Utility: Save zone file safely
function saveZone(zoneName, zoneData) {
  const zonePath = path.join(zonesDir, `${zoneName}.zone`);
  const zoneText = generateZoneFile(zoneData);
  fs.writeFileSync(zonePath, zoneText, 'utf-8');
}

function deleteZone(zoneName) {
  const zonePath = path.join(zonesDir, `${zoneName}.zone`);
  if (fs.existsSync(zonePath)) {
    fs.unlinkSync(zonePath);

  }
}

// Utility: Bump SOA serial
function bumpSOASerial(zone) {
  const now = new Date();
  const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  let currentSerial = zone.soa.serial.toString();
  let baseDate = currentSerial.substring(0, 8);
  let counter = parseInt(currentSerial.substring(8)) || 0;

  if (baseDate === today) counter++;
  else {
    baseDate = today;
    counter = 1;
  }
  zone.soa.serial = parseInt(`${baseDate}${String(counter).padStart(2, '0')}`);
}

// API: List all zones
app.get('/api/zones',requireAuth, (req, res) => {
  try {
    const zones = fs.readdirSync(zonesDir)
      .filter(file => file.endsWith('.zone'))
      .map(file => {
        const zoneName = file.replace('.zone', '');
        const zoneText = fs.readFileSync(path.join(zonesDir, file), 'utf-8');
        const parsedZone = simpleParseZone(zoneText);
        let lastUpdated = 'Unknown';
        if (parsedZone.soa?.serial) {
          const s = parsedZone.soa.serial.toString();
          if (s.length >= 8) lastUpdated = `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
        }
        return { zone: zoneName, lastUpdated };
      });
    res.json(zones);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not list zones' });
  }
});

// API: Create new zone
app.post('/api/zones',requireAuth, (req, res) => {
  try {
    const { zone } = req.body;
    const zonePath = path.join(zonesDir, `${zone}.zone`);

    if (fs.existsSync(zonePath)) return res.status(400).json({ error: 'Zone already exists' });

    const now = new Date();
    const serial = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}01`;

    const newZone = {
      $origin: zone,
      $ttl: 3600,
      soa: {
        mname: `ns1.${zone}.`,
        rname: `admin.${zone}.`,
        serial: parseInt(serial),
        refresh: 3600,
        retry: 600,
        expire: 1209600,
        minimum: 3600
      },
      ns: [{ host: `ns1.${zone}.` }],
      a: [{ name: "ns1", ip: "127.0.0.1" }]
    };

    saveZone(zone, newZone);

    fs.appendFileSync(bindDir, `\nzone \"${zone}\" { type master; file \"/etc/bind/zones/${zone}.zone\"; };\n`);

    res.json({ status: 'Zone created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create zone' });
  }
});

// API: Get records
app.get('/api/zones/:zone/records',requireAuth, (req, res) => {
  try {
    const zone = loadZone(req.params.zone);
    const records = [];
    ['a', 'aaaa', 'cname', 'mx', 'ns', 'txt', 'srv', 'ptr'].forEach(type => {
      if (zone[type]) {
        zone[type].forEach(record => {
          let value = '';
          if (type === 'a' || type === 'aaaa' || type === 'ptr') {
            value = record.ip;
          } else if (type === 'cname') {
            value = record.alias;
          } else if (type === 'mx') {
            value = `${record.preference} ${record.host}`;
          } else if (type === 'ns') {
            value = record.host;
          } else if (type === 'txt') {
            value = record.txt;
          } else if (type === 'srv') {
            value = `${record.priority} ${record.weight} ${record.port} ${record.target}`;
          }
    
          records.push({
            name: record.name,
            type: type.toUpperCase(),
            value,
            ttl: zone.$ttl || 3600,
            ...record
          });
        });
      }
    });
    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not read zone records' });
  }
});

// API: Add a record
app.post('/api/zones/:zone/records', requireAuth, (req, res) => {
  try {
    const { name, type, value } = req.body;
    const zoneName = req.params.zone;
    const zone = loadZone(zoneName);
    const lowerType = type.toLowerCase();

    if (!zone[lowerType]) {
      zone[lowerType] = [];
    }

    const record = { name };

    switch (lowerType) {
      case 'a':
      case 'aaaa':
      case 'ptr':
        record.ip = value;
        break;
      case 'cname':
        record.alias = value;
        break;
      case 'ns':
        record.host = value;
        break;
      case 'mx':
        const [preference, host] = value.split(' ');
        record.preference = parseInt(preference, 10);
        record.host = host;
        break;
      case 'txt':
        record.txt = value;
        break;
      case 'srv':
        const [priority, weight, port, target] = value.split(' ');
        record.priority = parseInt(priority, 10);
        record.weight = parseInt(weight, 10);
        record.port = parseInt(port, 10);
        record.target = target;
        break;
      default:
        return res.status(400).json({ error: 'Unsupported record type' });
    }

    zone[lowerType].push(record);
    bumpSOASerial(zone);
    saveZone(zoneName, zone);

    res.json({ status: 'Record added' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not add record' });
  }
});


// API: Delete a record
app.delete('/api/zones/:zone/records',requireAuth, (req, res) => {
  try {
    const { name, type } = req.body;
    const zoneName = req.params.zone;
    const zone = loadZone(zoneName);
    const lowerType = type.toLowerCase();

    if (!zone[lowerType]) return res.status(400).json({ error: 'Record type not found' });

    zone[lowerType] = zone[lowerType].filter(record => record.name !== name);
    bumpSOASerial(zone);
    saveZone(zoneName, zone);
    res.json({ status: 'Record deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete record' });
  }
});

// API: Delete a zone
app.delete('/api/zones/:zone',requireAuth, (req, res) => {
  try {
    const zoneName = req.params.zone;
    const zonePath = path.join(zonesDir, `${zoneName}.zone`);
    if (fs.existsSync(zonePath)) {
      fs.unlinkSync(zonePath);
    }
    res.json({ status: 'Zone deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete zone' });
  }
});


const { exec } = require('child_process');

app.post('/api/reload', requireAuth, (req, res) => {
  exec('rndc reload', (error, stdout, stderr) => {
    if (error) {
      console.error(`rndc reload failed: ${error}`);
      return res.status(500).json({ error: 'Failed to reload BIND' });
    }
    res.json({ status: 'BIND reloaded', message: stdout.trim() });
  });
});

// API: Get user info
app.get('/api/whoami', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.json({ loggedIn: false });
  }
  res.json({ loggedIn: true, user: req.session.user });
});


// Catch-all 404
app.use((req, res) => {
  res.status(404).send('404 Not Found');
});


// Start server
app.listen(PORT, () => {
  console.log(`DNS WebUI running on http://localhost:${PORT}`);
});
