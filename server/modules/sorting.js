function SortMethodsForField(fieldName, secFieldName) {
	this.fieldName = fieldName;
	this.secFieldName = secFieldName;

	this.sort_lowestFirst = (a, b)=> {
		var diff = a[this.fieldName] - b[this.fieldName]
		if(diff == 0) {
			return !this.secFieldName ? Math.random() < 0.5 ? -1 : 1
			: (a[this.secFieldName] >= b[this.secFieldName] ? 1 : -1);
		}
		return diff;
	}
		
	this.sort_lowestFirstNegFlip = (a, b)=> {
		var ai = a[this.fieldName];
		var bi = b[this.fieldName];
	
		var diff = ai - bi;
		if (ai < 0 !== bi < 0) {
		return ai < 0 ? 1 : -1;
		}

		if(diff === 0) {
			return !this.secFieldName ? Math.random() < 0.5 ? -1 : 1
			: (a[this.secFieldName] >= b[this.secFieldName] ? 1 : -1);
		}
	
		if (ai < 0 && bi < 0) {
			return -diff;
		}
		return diff;
	}
		
	 this.sort_highestFirst = (a, b)=> {
		var ai = parseInt(a[this.fieldName]); // < 0 ? Math.ceil(a[this.fieldName]) : Math.floor(a[this.fieldName]);
		var bi = parseInt(b[this.fieldName]); // < 0 ? Math.ceil(b[this.fieldName]) : Math.floor(b[this.fieldName]);
		var diff = bi - ai;
		if(diff == 0) {
			if (ai !== a[this.fieldName] || bi !== b[this.fieldName]) {
				if (ai !== a[this.fieldName] && bi !== b[this.fieldName]) {
					return this.sort_lowestFirstNegFlip(a, b);
				} else if (ai !== a[this.fieldName]) {
					return 1;
				} else {
					return -1;
				}
			} 
			return !this.secFieldName ? Math.random() < 0.5 ? -1 : 1
				: (a[this.secFieldName] >= b[this.secFieldName] ? 1 : -1)
		}
		return diff;
	}
		
	this.sort_highestFirstNegFlip = (a, b)=> {
		var ai = parseInt(a[this.fieldName]); // < 0 ? Math.ceil(a[this.fieldName]) : Math.floor(a[this.fieldName]);
		var bi = parseInt(b[this.fieldName]); // < 0 ? Math.ceil(b[this.fieldName]) : Math.floor(b[this.fieldName]);
	
		var diff = bi - ai;
		if(diff == 0) {
			if (ai !== a[this.fieldName] || bi !== b[this.fieldName]) {
				if (ai !== a[this.fieldName] && bi !== b[this.fieldName]) {
					return sort_lowestFirstNegFlip(a, b);
				} else if (ai !== a[this.fieldName]) {
					return 1;
				} else {
					return -1;
				}	
			} 
			return !this.secFieldName ? Math.random() < 0.5 ? -1 : 1
			  	   : (a[this.secFieldName] >= b[this.secFieldName] ? 1 : -1);
		}
	
		if (a < 0 && b < 0) {
			return -diff;
		}
		return diff;
	}
	this.array = [
		this.sort_lowestFirst,
		this.sort_lowestFirstNegFlip,
		this.sort_highestFirst,
		this.sort_highestFirstNegFlip
	];
}

module.exports = {
    getSortMethodsForField: function(field, secFieldName) {
		return new SortMethodsForField(field, secFieldName).array;
	},
	getSortingFunctionOf: function(val, methods) {
		if (!val) val = 0;
		if (val >= 4 || val < 0 ) val = 0; 
		return methods[val];
	}
}