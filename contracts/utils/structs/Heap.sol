// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Math} from "../math/Math.sol";
import {Comparators} from "../Comparators.sol";
import {Arrays} from "../Arrays.sol";
import {Panic} from "../Panic.sol";
import {StorageSlot} from "../StorageSlot.sol";

/**
 * @dev Library for managing https://en.wikipedia.org/wiki/Binary_heap[binary heap] that can be used as
 * https://en.wikipedia.org/wiki/Priority_queue[priority queue].
 *
 * Heaps are represented as an tree of values where the first element (index 0) is the root, and where the node at
 * index i is the child of the node at index (i-1)/2 and the father of nodes at index 2*i+1 and 2*i+2. Each node
 * stores an element of the heap.
 *
 * The structure is ordered so that each node is bigger than its parent. An immediate consequence is that the
 * highest priority value is the one at the root. This value can be looked up in constant time (O(1)) at
 * `heap.tree[0].value`
 *
 * The structure is designed to perform the following operations with the corresponding complexities:
 *
 * * peek (get the highest priority value): O(1)
 * * insert (insert a value): O(log(n))
 * * popPeek (remove the highest priority value): O(log(n))
 * * replace (replace the highest priority value with a new value): O(log(n))
 * * length (get the number of elements): O(1)
 * * clear (remove all elements): O(1)
 */
library Heap {
    using Arrays for *;
    using Math for *;

    /**
     * @dev Lookup the root element of the heap.
     */
    function peek(uint256[] storage heap) internal view returns (uint256) {
        // heap[0] will `ARRAY_ACCESS_OUT_OF_BOUNDS` panic if heap is empty.
        return heap[0];
    }

    /**
     * @dev Remove (and return) the root element for the heap using the default comparator.
     *
     * NOTE: All inserting and removal from a heap should always be done using the same comparator. Mixing comparator
     * during the lifecycle of a heap will result in undefined behavior.
     */
    function popPeek(uint256[] storage heap) internal returns (uint256) {
        return popPeek(heap, Comparators.lt);
    }

    /**
     * @dev Remove (and return) the root element for the heap using the provided comparator.
     *
     * NOTE: All inserting and removal from a heap should always be done using the same comparator. Mixing comparator
     * during the lifecycle of a heap will result in undefined behavior.
     */
    function popPeek(
        uint256[] storage heap,
        function(uint256, uint256) view returns (bool) comp
    ) internal returns (uint256) {
        unchecked {
            uint256 size = heap.length;
            if (size == 0) Panic.panic(Panic.EMPTY_ARRAY_POP);

            // cache
            uint256 rootValue = heap.unsafeAccess(0).value;
            uint256 lastValue = heap.unsafeAccess(size - 1).value;

            // swap last leaf with root, shrink tree and re-heapify
            heap.pop();
            heap.unsafeAccess(0).value = lastValue;
            _siftDown(heap, 0, lastValue, comp);

            return rootValue;
        }
    }

    /**
     * @dev Insert a new element in the heap using the default comparator.
     *
     * NOTE: All inserting and removal from a heap should always be done using the same comparator. Mixing comparator
     * during the lifecycle of a heap will result in undefined behavior.
     */
    function insert(uint256[] storage heap, uint256 value) internal {
        insert(heap, value, Comparators.lt);
    }

    /**
     * @dev Insert a new element in the heap using the provided comparator.
     *
     * NOTE: All inserting and removal from a heap should always be done using the same comparator. Mixing comparator
     * during the lifecycle of a heap will result in undefined behavior.
     */
    function insert(
        uint256[] storage heap,
        uint256 value,
        function(uint256, uint256) view returns (bool) comp
    ) internal {
        uint256 size = heap.length;
        // push new item and re-heapify
        heap.push(value);
        _siftUp(heap, size, value, comp);
    }

    /**
     * @dev Return the root element for the heap, and replace it with a new value, using the default comparator.
     * This is equivalent to using {popPeek} and {insert}, but requires only one rebalancing operation.
     *
     * NOTE: All inserting and removal from a heap should always be done using the same comparator. Mixing comparator
     * during the lifecycle of a heap will result in undefined behavior.
     */
    function replace(uint256[] storage heap, uint256 newValue) internal returns (uint256) {
        return replace(heap, newValue, Comparators.lt);
    }

    /**
     * @dev Return the root element for the heap, and replace it with a new value, using the provided comparator.
     * This is equivalent to using {popPeek} and {insert}, but requires only one rebalancing operation.
     *
     * NOTE: All inserting and removal from a heap should always be done using the same comparator. Mixing comparator
     * during the lifecycle of a heap will result in undefined behavior.
     */
    function replace(
        uint256[] storage heap,
        uint256 newValue,
        function(uint256, uint256) view returns (bool) comp
    ) internal returns (uint256) {
        if (heap.length == 0) Panic.panic(Panic.EMPTY_ARRAY_POP);

        // cache
        uint256 oldValue = heap.unsafeAccess(0).value;

        // replace and re-heapify
        heap.unsafeAccess(0).value = newValue;
        _siftDown(heap, 0, newValue, comp);

        return oldValue;
    }

    /**
     * @dev Removes all elements in the heap.
     */
    function clear(uint256[] storage heap) internal {
        heap.unsafeSetLength(0);
    }

    /**
     * @dev Swap node `i` and `j` in the tree.
     */
    function _swap(uint256[] storage heap, uint256 i, uint256 j) private {
        StorageSlot.Uint256Slot storage ni = heap.unsafeAccess(i);
        StorageSlot.Uint256Slot storage nj = heap.unsafeAccess(j);
        (ni.value, nj.value) = (nj.value, ni.value);
    }

    /**
     * @dev Perform heap maintenance on `self`, starting at `index` (with the `value`), using `comp` as a
     * comparator, and moving toward the leafs of the underlying tree.
     *
     * NOTE: This is a private function that is called in a trusted context with already cached parameters. `length`
     * and `value` could be extracted from `self` and `index`, but that would require redundant storage read. These
     * parameters are not verified. It is the caller role to make sure the parameters are correct.
     */
    function _siftDown(
        uint256[] storage heap,
        uint256 index,
        uint256 value,
        function(uint256, uint256) view returns (bool) comp
    ) private {
        uint256 size = heap.length;
        uint256 left = 2 * index + 1; // this could not realistically overflow
        uint256 right = 2 * index + 2; // this could not realistically overflow

        if (right < size) {
            uint256 lValue = heap.unsafeAccess(left).value;
            uint256 rValue = heap.unsafeAccess(right).value;
            if (comp(lValue, value) || comp(rValue, value)) {
                uint256 sIndex = uint256(comp(lValue, rValue).ternary(left, right));
                _swap(heap, index, sIndex);
                _siftDown(heap, sIndex, value, comp);
            }
        } else if (left < size) {
            uint256 lValue = heap.unsafeAccess(left).value;
            if (comp(lValue, value)) {
                _swap(heap, index, left);
                _siftDown(heap, left, value, comp);
            }
        }
    }

    /**
     * @dev Perform heap maintenance on `self`, starting at `index` (with the `value`), using `comp` as a
     * comparator, and moving toward the root of the underlying tree.
     *
     * NOTE: This is a private function that is called in a trusted context with already cached parameters. `value`
     * could be extracted from `self` and `index`, but that would require redundant storage read. These parameters are not
     * verified. It is the caller role to make sure the parameters are correct.
     */
    function _siftUp(
        uint256[] storage heap,
        uint256 index,
        uint256 value,
        function(uint256, uint256) view returns (bool) comp
    ) private {
        unchecked {
            while (index > 0) {
                uint256 parentIndex = (index - 1) / 2;
                uint256 parentValue = heap.unsafeAccess(parentIndex).value;
                if (comp(parentValue, value)) break;
                _swap(heap, index, parentIndex);
                index = parentIndex;
            }
        }
    }
}
