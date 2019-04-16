 function sort_lowestFirst(a, b) {
    var diff = a.initVal - b.initVal
    if(diff == 0) {
      return Math.random() < 0.5 ? -1 : 1;
    }
    return diff;
  }
  
  function sort_lowestFirstNegFlip(a, b) {
    a = a.initVal;
    b = b.initVal;
  
    var diff = a - b;
    if (a < 0 !== b < 0) {
      return a < 0 ? 1 : -1;
    }

    if(diff === 0) {
      return Math.random() < 0.5 ? -1 : 1;
    }
  
    if (a < 0 && b < 0) {
      return -diff;
    }
    return diff;
  }
  
  function sort_highestFirst(a, b) {
    var ai = a.initVal < 0 ? Math.ceil(a.initVal) : Math.floor(a.initVal);
    var bi = b.initVal < 0 ? Math.ceil(b.initVal) : Math.floor(b.initVal);
    var diff = bi - ai;
    if(diff == 0) {
      if (ai !== a.initVal || bi !== b.initVal) {
        if (ai !== a.initVal && bi !== b.initVal) {
          return sort_lowestFirstNegFlip(a, b);
        } else if (ai !== a.initVal) {
          return 1;
        } else {
          return -1;
        }
        
      } 
      return Math.random() < 0.5 ? -1 : 1;
    }
    return diff;
  }
  
  function sort_highestFirstNegFlip(a, b) {
    var ai = a.initVal < 0 ? Math.ceil(a.initVal) : Math.floor(a.initVal);
    var bi = b.initVal < 0 ? Math.ceil(b.initVal) : Math.floor(b.initVal);
  
    var diff = bi - ai;
     if(diff == 0) {
      if (ai !== a.initVal || bi !== b.initVal) {
        if (ai !== a.initVal && bi !== b.initVal) {
          return sort_lowestFirstNegFlip(a, b);
        } else if (ai !== a.initVal) {
          return 1;
        } else {
          return -1;
        }
        
      } 
      return Math.random() < 0.5 ? -1 : 1;
    }
  
    if (a < 0 && b < 0) {
      return -diff;
    }
    return diff;
  }

  var testArr = [
    { initVal: 4.2},
    { initVal: 1.6},
    { initVal: 3.3},
     { initVal: -2.2},
    { initVal: -1.3},
     { initVal: -4.6},
       { initVal: -1.4},
    { initVal: 2.3},
     { initVal: 3.1},
         { initVal: 4.3},
    { initVal: 4},
    { initVal: 3},
     { initVal: -2.1},
       { initVal: 4.6},
    { initVal: -1},
     { initVal: 3.2},
      { initVal: -2},
     { initVal: -4.1},
     { initVal: -4},
    { initVal: 1},
       { initVal: 2.2},
         { initVal: -1.2},
     { initVal: 2.1},
    { initVal: 4.1},
      { initVal: 2},
       { initVal: -2.4}
  ];

  testArr.sort(sort_lowestFirstNegFlip);

  console.log(testArr);