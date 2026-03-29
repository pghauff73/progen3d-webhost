// Extracted from original file lines 3687-3742
            /*Variable========================================== */

//                                                           Variable Class

/* ======================================================= */
const variable_list = [];
const full_variable_list = [];

class Variable {
  constructor(name, min, max, i) {
    if (typeof max==="undefined" && typeof i==="undefined") {
      this.var_name=name; this.min=0; this.max=0; this.value=min; this.instance_count=0; this.integer=false; return;
    }
    this.var_name=name; this.min=min; this.max=max; this.integer=!!i; this.instance_count=0;
    const u=RNG.random();
    this.value = this.integer
      ? Math.floor(u*(Math.floor(max)-Math.ceil(min)+1))+Math.ceil(min)
      : u*(max-min)+min;
  }
  getRandom() {
    const u=RNG.random();
    return this.integer
      ? Math.floor(u*(Math.floor(this.max)-Math.ceil(this.min)+1))+Math.ceil(this.min)
      : u*(this.max-this.min)+this.min;
  }
}
function findVariableForward(var_name){
 for (let i=0;i<variable_list.length;i++)
    if (variable_list[i].var_name===var_name) 
    return i; 
return -1; 
}

function removeVariable(var_name){
  for (let i=variable_list.length-1;i>=0;i--){
    if (variable_list[i].var_name===var_name && variable_list[i].max===variable_list[i].min) { variable_list.splice(i,1); return; }
  }
}
function addVariable(var_name,min,max,integer){
  if (findVariableForward(var_name)===-1){
    const v=new Variable(var_name,min,max,integer); v.value=v.getRandom();
    variable_list.push(v); full_variable_list.push(v);

  }
}
function addVariableInstance(var_name){
  const idx=findVariableForward(var_name); if (idx!==-1){

    const ref=variable_list[idx], v=new Variable(var_name, ref.getRandom());
    variable_list.push(v); full_variable_list.push(v);


  }
}
