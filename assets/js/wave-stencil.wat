;; Build with wat2wasm wave-stencil.wat -o wave-stencil.wasm
(module
  (memory (export "memory") 1)
  ;; Byte addresses for a nonempty row segment whose length is a multiple of four cells.
  (func (export "row") (param $src i32) (param $dst i32) (param $end i32)
                       (param $stride i32) (param $decay f32) (param $limit f32)
    (loop $next
      (v128.store align=4 (local.get $dst)
        (f32x4.max
          (f32x4.min
            (f32x4.mul
          (f32x4.add
            (f32x4.sub
              (f32x4.mul (v128.load align=4 (local.get $src)) (f32x4.splat (f32.const 2)))
              (v128.load align=4 (local.get $dst)))
            (f32x4.mul
              (f32x4.sub
                (f32x4.add
                  (f32x4.add
                    (f32x4.add
                      (v128.load align=4 (i32.sub (local.get $src) (i32.const 4)))
                      (v128.load align=4 (i32.add (local.get $src) (i32.const 4))))
                    (v128.load align=4 (i32.sub (local.get $src) (local.get $stride))))
                  (v128.load align=4 (i32.add (local.get $src) (local.get $stride))))
                (f32x4.mul (v128.load align=4 (local.get $src)) (f32x4.splat (f32.const 4))))
              (f32x4.splat (f32.const 0.1))))
          (f32x4.splat (local.get $decay)))
            (f32x4.splat (local.get $limit)))
          (f32x4.splat (f32.neg (local.get $limit)))))
      (local.set $src (i32.add (local.get $src) (i32.const 16)))
      (local.set $dst (i32.add (local.get $dst) (i32.const 16)))
      (br_if $next (i32.lt_u (local.get $src) (local.get $end))))))
