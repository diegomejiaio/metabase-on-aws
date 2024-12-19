import * as fs from 'fs';
import * as path from 'path';

const directoryPath = path.join(__dirname, 'lib');
const outputPath = path.join(__dirname, 'fileListWithContent.txt');

fs.readdir(directoryPath, (err, files) => {
    if (err) {
        return console.log('Unable to scan directory: ' + err);
    }

    let fileListWithContent = '';

    files.forEach((file) => {
        const filePath = path.join(directoryPath, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        fileListWithContent += `File: ${file}\n\n${fileContent}\n\n`;
    });

    fs.writeFile(outputPath, fileListWithContent, (err) => {
        if (err) {
            return console.log('Unable to write file: ' + err);
        }
        console.log('File list with content saved to ' + outputPath);
    });
});