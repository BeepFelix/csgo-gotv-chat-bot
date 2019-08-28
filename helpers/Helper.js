module.exports = class Helper {
	static chunkArray(myArray, chunk_size) {
		let tempArray = [];
	
		for (let index = 0; index < myArray.length; index += chunk_size) {
			let myChunk = myArray.slice(index, index + chunk_size);
			tempArray.push(myChunk);
		}
	
		return tempArray;
	}	
}
