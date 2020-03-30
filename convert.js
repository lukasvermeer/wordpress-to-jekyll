const xml2js = require('xml2js');
const fs = require('fs');
const toMarkdown = require('to-markdown');
const request = require('request');

function downloadFile(url, path) {
  // console.log("Attempt downloading " + url + " to " + path + ' ' + url.indexOf("https:") );
  if (url.indexOf('https:') === -1) {
    if (url.indexOf('.jpg') >= 0 || url.indexOf('.jpeg') >= 0 || url.indexOf('.png') >= 0 || url.indexOf('.png') >= 0) {
      const file = fs.createWriteStream(path);
      request(url).pipe(file);
    } else {
      console.log(`passing on: ${url} ${url.indexOf('https:')}`);
    }
  } else {
    console.log(`passing on: ${url} ${url.indexOf('https:')}`);
  }
}

function getPaddedMonthNumber(month) {
  if (month < 10) return `0${month}`;
  return month;
}

function getPaddedDayNumber(day) {
  if (day < 10) return `0${day}`;
  return day;
}

function processPost(post) {
  console.log('Processing Post');

  const status = post['wp:status'];
  console.log(`Post status: ${status}`);
  if (`${status}` !== 'publish') {
    return;
  }

  const postTitle = post.title;
  console.log(`Post title: ${postTitle}`);
  const postLink = post.link;
  const postDate = new Date(post.pubDate);
  console.log(`Post Date: ${postDate}`);
  let postData = post['content:encoded'][0];
  console.log(`Post length: ${postData.length} bytes`);
  const slug = post['wp:post_name'];
  console.log(`Post slug: ${slug}`);

  // Merge categories and tags into tags
  const categories = [];
  if (post.category !== undefined) {
    for (let i = 0; i < post.category.length; i += 1) {
      const cat = post.category[i]._;
      if (`${cat}` !== 'Uncategorized') categories.push(cat);
      // console.log('CATEGORY: ' + util.inspect(post.category[i]['_']));
    }
  }

  const fullPostName = `${postDate.getFullYear()}-${getPaddedMonthNumber(postDate.getMonth() + 1)}-${getPaddedDayNumber(postDate.getDate())}-${slug}`;
  const fullPath = `out/_posts/${fullPostName}`;

  // Find all images
  const patt = new RegExp('(?:src="(.*?)")', 'gi');

  let m;
  const matches = [];
  while ((m = patt.exec(postData)) !== null) {
    matches.push(m[1]);
    // console.log("Found: " + m[1]);
  }


  if (matches != null && matches.length > 0) {
    fs.mkdir('out/assets', () => {
      for (let i = 0; i < matches.length; i += 1) {
        // console.log('Post image found: ' + matches[i])

        const url = matches[i];
        const urlParts = matches[i].split('/');
        const imageName = urlParts[urlParts.length - 1];

        const filePath = `out/assets/${fullPostName}-${imageName}`;

        downloadFile(url, filePath);
      }
    });
  }

  for (let i = 0; i < matches.length; i += 1) {
    const url = matches[i];
    const urlParts = matches[i].split('/');
    const imageName = urlParts[urlParts.length - 1];

    // Make the image name local relative in the markdown
    postData = postData.replace(url, "{{site.baseurl}}{% link assets/" + fullPostName + "-" + imageName + " %}");
    // console.log('Replacing ' + url + ' with ' + imageName);
  }

  let markdown = toMarkdown.toMarkdown(postData);

  // Fix characters that markdown doesn't like
  // smart single quotes and apostrophe
  markdown = markdown.replace(/[\u2018|\u2019|\u201A]/g, "\'");
  // smart double quotes
  markdown = markdown.replace(/&quot;/g, '"');
  markdown = markdown.replace(/[\u201C|\u201D|\u201E]/g, '"');
  // ellipsis
  markdown = markdown.replace(/\u2026/g, '...');
  // dashes
  markdown = markdown.replace(/[\u2013|\u2014]/g, '-');
  // circumflex
  markdown = markdown.replace(/\u02C6/g, '^');
  // open angle bracket
  markdown = markdown.replace(/\u2039/g, '<');
  markdown = markdown.replace(/&lt;/g, '<');
  // close angle bracket
  markdown = markdown.replace(/\u203A/g, '>');
  markdown = markdown.replace(/&gt;/g, '>');
  // spaces
  markdown = markdown.replace(/[\u02DC|\u00A0]/g, ' ');
  // ampersand
  markdown = markdown.replace(/&amp;/g, '&');

  let header = '';
  header += '---\n';
  header += 'layout: post\n';
  header += `title: "${postTitle}"\n`;
  header += `date: ${postDate.getFullYear()}-${getPaddedMonthNumber(postDate.getMonth() + 1)}-${getPaddedDayNumber(postDate.getDate())}\n`;
  if (categories.length > 0) header += `tags: ${JSON.stringify(categories)}\n`;
  header += 'original:\n';
  header += '  source_name: Wordpress\n';
  header += `  source_url: ${postLink}\n`;
  header += '---\n';
  header += '\n';

  fs.writeFile(`${fullPath}.markdown`, header + markdown, (err) => {
    if (err) { console.log(`Error writing file: ${err}`); }
  });
}

function processExport() {
  const parser = new xml2js.Parser();
  fs.readFile('export.xml', (err, data) => {
    if (err) {
      console.log(`Error: ${err}`);
    }

    parser.parseString(data, (err2, result) => {
      if (err2) {
        console.log(`Error parsing xml: ${err2}`);
      }
      console.log('Parsed XML');
      // console.log(util.inspect(result.rss.channel));

      const posts = result.rss.channel[0].item;


      fs.mkdir('out', () => {
        fs.mkdir('out/_posts', () => {
          for (let i = 0; i < posts.length; i += 1) {
            processPost(posts[i]);
            // console.log(util.inspect(posts[i]));
          }
        });
      });
    });
  });
}

processExport();
