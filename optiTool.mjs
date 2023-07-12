import imagemin from 'imagemin';
import imageminPngquant from 'imagemin-pngquant';
import imageminWebp from 'imagemin-webp';
import imageminJpegtran from 'imagemin-jpegtran';
import {copyFileSync, lstatSync, readdirSync, renameSync, unlinkSync} from 'fs';
import {extname, join, normalize} from 'path';
import minimist from 'minimist';

const cliArguments = minimist(process.argv.slice(2));
const inputDir = 'resources';
const colors = {
  yellow: '\x1b[33m%s\x1b[0m',
  green: '\x1b[32m%s\x1b[0m',
  red: '\x1b[31m%s\x1b[0m'
};

if (!cliArguments.hasOwnProperty('o')) {
  console.log(colors.red, 'Please provide an options type.');
  console.log(colors.yellow, 'Options: compress, webp');
  console.log(colors.yellow, 'Example: node optiTool.mjs -o compress');
  process.exit(1);
}

const isDirectory = source => lstatSync(source).isDirectory();
const getDirectories = source =>
  readdirSync(source)
    .map(name => join(source, name))
    .filter(isDirectory);

const getDirectoriesRecursive = source => [
  normalize(source),
  ...getDirectories(source)
    .map(getDirectoriesRecursive)
    .reduce((a, b) => a.concat(b), [])
];

const convertSlash = path => {
  const isExtendedLengthPath = /^\\\\\?\\/.test(path);
  const hasNonAscii = /[^\u0000-\u0080]+/.test(path);
  
  if (isExtendedLengthPath || hasNonAscii) {
    return path;
  }
  
  return path.replace(/\\/g, '/');
};

try {
  (async () => {
    const imageDirs = getDirectoriesRecursive(inputDir);
    let imagesOptimized = 0;
    let imagesSaved = 0;
    let webpsDeleted = 0;
    
    if (cliArguments.o === 'compress') {
      console.log(colors.yellow, 'Beginning image compression...');
    } else if (cliArguments.o === 'webp') {
      console.log(colors.yellow, 'Beginning image conversion to webp...');
    } else if (cliArguments.o === 'purgewebps') {
      console.log(colors.yellow, 'Beginning webp files purge...');
    }
    
    for (let i in imageDirs) {
      const dir = imageDirs[i];
      const destiny = convertSlash(dir);
      
      if (cliArguments.o === 'compress') {
        const files = await imagemin([`${convertSlash(dir)}/*.{jpg,png}`], {
          destination: convertSlash(destiny),
          plugins: [
            imageminJpegtran(),
            imageminPngquant({
              strip: true,
              quality: [0.6, 0.8]
            }),
          ]
        });
        
        const fileObject = files[0];
        
        if (fileObject && fileObject.hasOwnProperty('sourcePath')) {
          console.log('\n');
          console.log(colors.yellow, `File '${fileObject.sourcePath}'`);
          console.log(colors.green, `Saved into: '${destiny}'`);
          
          imagesOptimized += files.length;
        }
        
      } else if (cliArguments.o === 'webp') {
        const currentFiles = readdirSync(dir);
        const pngFiles = currentFiles.filter(file => file.endsWith('.png'));
        
        pngFiles.forEach(pngFile => {
          const sourcePath = join(dir, pngFile);
          const destinyPath = join(dir, `clone-${pngFile}`);
          
          copyFileSync(sourcePath, destinyPath);
        });
        
        const webpFiles = await imagemin([`${convertSlash(dir)}/clone-*.png`], {
          destination: convertSlash(destiny),
          plugins: [
            imageminWebp({
              quality: 50,
              method: 6,
              nearLossless: 20
            })
          ]
        });
        
        const oldPngFiles = readdirSync(dir);
        
        const oldPngFilesArray = oldPngFiles.filter(file => {
          const extName = extname(file);
          const isPng = extName === '.png';
          const hasClonePrefix = file.startsWith('clone-');
          
          return isPng && hasClonePrefix;
        });
        
        oldPngFilesArray.forEach(oldPngFile => {
          const filePath = join(dir, oldPngFile);
          
          unlinkSync(filePath);
        });
        
        const newFiles = readdirSync(dir);
        const freshWebpFiles = newFiles.filter(file => file.endsWith('.webp'));
        
        freshWebpFiles.forEach(webpFile => {
          const sourcePath = join(dir, webpFile);
          const targetPath = join(dir, webpFile.replace('clone-', ''));
          
          renameSync(sourcePath, targetPath);
        });
        
        const webpFileObject = webpFiles[0];
        
        if (webpFileObject && webpFileObject.hasOwnProperty('sourcePath')) {
          console.log('\n');
          console.log(colors.yellow, `File '${webpFileObject.sourcePath}'`);
          console.log(colors.green, `Saved into: '${destiny}'`);
          
          imagesSaved += webpFiles.length;
        }
      } else if (cliArguments.o === 'purgewebps') {
        const webpFiles = readdirSync(dir);
        
        const webpsToDeleteArray = webpFiles.filter(file => file.endsWith('.webp'));
        
        webpsToDeleteArray.forEach(webpFile => {
          const filePath = join(dir, webpFile);
          
          unlinkSync(filePath);
        });
        
        webpsDeleted += 1;
      }
    }
    
    if (cliArguments.o === 'compress') {
      console.log('\n');
      console.log(colors.yellow, `Image compression finished. Total images compressed: ${imagesOptimized}`);
    } else if (cliArguments.o === 'webp') {
      console.log('\n');
      console.log(colors.yellow, `Images saved as webp. Total images saved: ${imagesSaved}`);
    } else if (cliArguments.o === 'purgewebps') {
      console.log('\n');
      console.log(colors.yellow, `Webp files purged. Total webp files deleted: ${webpsDeleted}`);
    }
  })();
} catch (e) {
  console.log(colors.red, 'Error while compressing images, please review your input parameters.');
  console.error(e);
}
