const mammoth = require('mammoth');

function ConverterService() {
    return {
        docxToMarkdown: async (docx) => {
            try {
                const result = await mammoth.convertToMarkdown({ buffer: docx });
                return result.value;
            } catch (error) {
                throw new Error(`Failed to convert docx to markdown: ${error.message}`);
            }
        },
    }
}

module.exports = ConverterService();