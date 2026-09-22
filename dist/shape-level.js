// n remains the column stride for compatibility with the original 50 puzzles.
export function shapeLevel(data) {
  const key=`shapes-v1-${data.id}`;
  return {id:data.id,key,n:data.cols,rows:data.rows,moves:data.moves,
    ...(data.mask?{mask:[...data.mask]}:{}),chapter:`shapes-${Math.floor((data.id-51)/10)}`,
    title:data.title,lesson:data.lesson,objective:data.objective,
    board:data.values.map((v,i)=>v===null?null:{v,star:data.stars.includes(i),id:`${key}-${i}`})};
}
