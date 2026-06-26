fetch('http://localhost:3000/api/export/app-backup.json')
  .then(res => res.text())
  .then(data => {
    try {
      const j = JSON.parse(data);
      console.log("Database:", j.database);
      console.log("Advances:", j.state?.advances?.length);
      console.log("Users:", j.stores?.['master-users']?.length);
      console.log("Templates:", j.stores?.['line-messaging-templates']?.length);
    } catch(e) {
      console.log("Not JSON:", data.substring(0, 100));
    }
  })
  .catch(err => console.error(err));
